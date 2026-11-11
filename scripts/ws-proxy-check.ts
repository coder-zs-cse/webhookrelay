import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { WebSocket, WebSocketServer } from "ws";
import { relayWebSocket, type WsRelayResult } from "../src/lib/wsRelay";
import { toUpstreamWebSocketUrl } from "../src/lib/wsTarget";

function assertUrl(
  target: string,
  search: string,
  expected: { protocol: string; pathname: string; params: Record<string, string> }
) {
  const actual = new URL(toUpstreamWebSocketUrl(target, search));
  assert.equal(actual.protocol, expected.protocol);
  assert.equal(actual.pathname, expected.pathname);
  for (const [key, value] of Object.entries(expected.params)) {
    assert.equal(actual.searchParams.get(key), value);
  }
  assert.equal(actual.searchParams.size, Object.keys(expected.params).length);
}

assertUrl("https://ngrok.example/ozonetel/audiostream", "?authToken=a&callUuid=1", {
  protocol: "wss:",
  pathname: "/ozonetel/audiostream",
  params: { authToken: "a", callUuid: "1" },
});
assertUrl("wss://ngrok.example/ozonetel/audiostream?keep=1", "authToken=a", {
  protocol: "wss:",
  pathname: "/ozonetel/audiostream",
  params: { keep: "1", authToken: "a" },
});
assertUrl("http://127.0.0.1:9/path?x=1", "?x=2", {
  protocol: "ws:",
  pathname: "/path",
  params: { x: "2" },
});
assert.throws(() => toUpstreamWebSocketUrl("ftp://example/path", ""), /http, https, ws, or wss/);

function listen(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1");
  return once(server, "listening").then(() => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("expected a TCP port");
    return address.port;
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function waitForResult(
  results: WsRelayResult[],
  predicate: (result: WsRelayResult) => boolean
): Promise<WsRelayResult> {
  const existing = results.find(predicate);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(timer);
      reject(new Error("timed out waiting for relay result"));
    }, 3000);
    const timer = setInterval(() => {
      const found = results.find(predicate);
      if (!found) return;
      clearTimeout(timeout);
      clearInterval(timer);
      resolve(found);
    }, 10);
  });
}

async function main() {
  let upstreamRequestUrl = "";
  const echoHttp = createServer();
  const echo = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    handleProtocols: (protocols) => (protocols.has("audio") ? "audio" : false),
  });
  echoHttp.on("upgrade", (req, socket, head) => {
    echo.handleUpgrade(req, socket, head, (ws) => {
      upstreamRequestUrl = req.url ?? "";
      ws.on("message", (data, isBinary) => {
        if (!isBinary && data.toString() === "close-now") {
          ws.close(4001, "done");
          return;
        }
        ws.send(data, { binary: isBinary });
      });
    });
  });
  const echoPort = await listen(echoHttp);

  const dead = createServer();
  dead.on("upgrade", (_req, socket) => {
    socket.write("HTTP/1.1 500 Nope\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    socket.end();
  });
  const deadPort = await listen(dead);

  const results: WsRelayResult[] = [];
  const relay = createServer();
  relay.on("upgrade", (req, socket, head) => {
    socket.on("error", () => {});
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    const target = pathname.endsWith("/fail")
      ? `http://127.0.0.1:${deadPort}/nope`
      : `http://127.0.0.1:${echoPort}/ozonetel/audiostream?keep=1`;
    relayWebSocket(req, socket, head, target, (result) => {
      results.push(result);
    });
  });
  const relayPort = await listen(relay);

  const client = new WebSocket(`ws://127.0.0.1:${relayPort}/r/ozonetel?authToken=a&callUuid=1`);
  const frames: { isBinary: boolean; data: Buffer }[] = [];
  client.on("message", (data, isBinary) => {
    frames.push({ isBinary, data: Buffer.from(data as Buffer) });
  });

  await once(client, "open");
  client.send("ping-text");
  client.send(Buffer.from([1, 2, 3]));

  await new Promise<void>((resolve, reject) => {
    if (frames.length >= 2) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => reject(new Error("timed out waiting for echoed frames")), 3000);
    client.on("message", () => {
      if (frames.length >= 2) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  assert.equal(frames[0].isBinary, false);
  assert.equal(frames[0].data.toString(), "ping-text");
  assert.equal(frames[1].isBinary, true);
  assert.deepEqual([...frames[1].data], [1, 2, 3]);

  const upstreamUrl = new URL(upstreamRequestUrl, "http://localhost");
  assert.equal(upstreamUrl.pathname, "/ozonetel/audiostream");
  assert.equal(upstreamUrl.searchParams.get("keep"), "1");
  assert.equal(upstreamUrl.searchParams.get("authToken"), "a");
  assert.equal(upstreamUrl.searchParams.get("callUuid"), "1");

  client.send("close-now");
  const [closeCode, closeReason] = (await once(client, "close")) as [number, Buffer];
  assert.equal(closeCode, 4001);
  assert.equal(closeReason.toString(), "done");

  const call = results.find((result) => result.queryParams.callUuid === "1");
  assert.equal(call?.opened, true);
  assert.match(call?.error ?? "", /4001/);

  const audioClient = new WebSocket(`ws://127.0.0.1:${relayPort}/r/ozonetel`, ["audio"]);
  await once(audioClient, "open");
  assert.equal(audioClient.protocol, "audio");
  audioClient.close(1000);
  await once(audioClient, "close");
  const audio = await waitForResult(
    results,
    (result) => result.opened && result.queryParams.callUuid === undefined && result.error === null
  );
  assert.equal(audio.opened, true);

  const failingClient = new WebSocket(`ws://127.0.0.1:${relayPort}/r/fail?authToken=a`);
  const failure = waitForResult(results, (result) => result.opened === false);
  await once(failingClient, "error");
  const failureResult = await failure;
  assert.ok(failureResult.error, "expected the failed dial to be reported");

  await close(relay);
  await close(echoHttp);
  await close(dead);
  console.log("ws proxy check passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
