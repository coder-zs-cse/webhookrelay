import { IncomingMessage } from "node:http";
import { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { toUpstreamWebSocketUrl } from "./wsTarget";

const UPSTREAM_HANDSHAKE_TIMEOUT_MS = 10_000;

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  404: "Not Found",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export type WsRelayResult = {
  upstreamUrl: string;
  opened: boolean;
  error: string | null;
  durationMs: number;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
};

export function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  if (socket.destroyed) return;
  const body = message;
  const payload =
    `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? "Error"}\r\n` +
    "Content-Type: text/plain; charset=utf-8\r\n" +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    "Connection: close\r\n" +
    "\r\n" +
    body;
  socket.once("error", () => {});
  socket.end(payload);
}

function offeredProtocols(header: string | string[] | undefined): string[] | undefined {
  const raw = Array.isArray(header) ? header.join(",") : header ?? "";
  const protocols = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return protocols.length > 0 ? protocols : undefined;
}

function queryFrom(req: IncomingMessage): Record<string, string> {
  const query: Record<string, string> = {};
  const url = new URL(req.url ?? "/", "http://localhost");
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

/** Close codes 1005 and 1006 are reserved and must not be written on the wire. */
function safeClose(socket: WebSocket, code: number, reason: Buffer): void {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.terminate();
    return;
  }
  if (socket.readyState !== WebSocket.OPEN) return;

  const sendable = code === 1000 || (code >= 1001 && code <= 1014) || (code >= 3000 && code <= 4999);
  if (!sendable) {
    socket.close();
    return;
  }
  socket.close(code, reason.toString().slice(0, 123));
}

function pipe(from: WebSocket, to: WebSocket): void {
  from.on("message", (data, isBinary) => {
    if (to.readyState !== WebSocket.OPEN) return;
    try {
      to.send(data, { binary: isBinary });
    } catch {
      // The close handler ends the relay.
    }
  });
}

/**
 * Dial upstream first, then accept the caller. The negotiated subprotocol is only
 * known once the upstream handshake finishes, and it has to be the one we echo.
 */
export function relayWebSocket(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  targetUrl: string,
  onClosed: (result: WsRelayResult) => void
): void {
  const started = Date.now();
  const queryParams = queryFrom(req);
  const protocols = offeredProtocols(req.headers["sec-websocket-protocol"]);
  const headers: Record<string, string> = {
    "user-agent": "WebhookRelay/1.0",
    "ngrok-skip-browser-warning": "true",
  };
  if (protocols) headers["sec-websocket-protocol"] = protocols.join(", ");

  let upstreamUrl = "";
  let settled = false;
  let opened = false;
  let errorMessage: string | null = null;

  const finish = (didOpen: boolean, error: string | null) => {
    if (settled) return;
    settled = true;
    onClosed({
      upstreamUrl,
      opened: didOpen,
      error,
      durationMs: Date.now() - started,
      queryParams,
      headers,
    });
  };

  let upstream: WebSocket;
  let clientRef: WebSocket | null = null;
  try {
    const incoming = new URL(req.url ?? "/", "http://localhost");
    upstreamUrl = toUpstreamWebSocketUrl(targetUrl, incoming.search);
    upstream = new WebSocket(upstreamUrl, protocols, {
      perMessageDeflate: false,
      handshakeTimeout: UPSTREAM_HANDSHAKE_TIMEOUT_MS,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid WebSocket target";
    rejectUpgrade(socket, 400, message);
    finish(false, message);
    return;
  }

  const fail = (message: string) => {
    if (settled || opened) return;
    settled = true;
    rejectUpgrade(socket, 502, message);
    upstream.terminate();
    onClosed({
      upstreamUrl,
      opened: false,
      error: message,
      durationMs: Date.now() - started,
      queryParams,
      headers,
    });
  };

  const end = (code: number, reason: Buffer) => {
    if (settled || !opened) return;
    const abnormal = code !== 1000 && code !== 1001 && code !== 1005;
    const error = errorMessage ?? (abnormal ? `closed ${code} ${reason.toString()}`.trim() : null);
    // Mark settled before closing so the peer's close event does not re-enter.
    settled = true;
    if (clientRef) safeClose(clientRef, code, reason);
    safeClose(upstream, code, reason);
    onClosed({
      upstreamUrl,
      opened: true,
      error,
      durationMs: Date.now() - started,
      queryParams,
      headers,
    });
  };

  upstream.on("unexpected-response", (_request, response) => {
    response.resume();
    fail(`upstream HTTP ${response.statusCode ?? 502}`);
  });

  upstream.on("error", (err) => {
    errorMessage = err.message;
    if (!opened) fail(err.message);
    else end(1011, Buffer.from(err.message));
  });

  upstream.on("close", (code, reason) => {
    if (opened) end(code, reason);
  });

  upstream.once("open", () => {
    if (settled) {
      upstream.close();
      return;
    }

    const acceptor = new WebSocketServer({
      noServer: true,
      perMessageDeflate: false,
      handleProtocols: (offered) => {
        if (upstream.protocol && offered.has(upstream.protocol)) return upstream.protocol;
        return false;
      },
    });

    try {
      acceptor.handleUpgrade(req, socket, head, (client) => {
        opened = true;
        clientRef = client;
        pipe(client, upstream);
        pipe(upstream, client);

        client.on("error", (err) => {
          errorMessage = err.message;
          end(1011, Buffer.from(err.message));
        });
        client.on("close", (code, reason) => end(code, reason));
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "WebSocket upgrade failed";
      fail(message);
    }
  });
}
