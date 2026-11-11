import { createServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import next from "next";

if (process.argv.includes("--start")) {
  Object.assign(process.env, { NODE_ENV: "production" });
}

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const app = next({ dev, hostname: "localhost", port });
const handle = app.getRequestHandler();

function relaySlug(pathname: string): string | null {
  const match = pathname.match(/^\/r\/([a-z0-9-]+)\/?$/);
  return match ? match[1] : null;
}

async function main() {
  await app.prepare();

  // Prisma reads DATABASE_URL when the client is constructed. Next has loaded
  // .env by the time prepare() resolves, so import it only after that.
  const { prisma } = await import("./src/lib/prisma");
  const { saveLog } = await import("./src/lib/requestLog");
  const { relayWebSocket, rejectUpgrade } = await import("./src/lib/wsRelay");
  const upgrade = app.getUpgradeHandler();

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    socket.on("error", () => {});
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

    if (!pathname.startsWith("/r/")) {
      void upgrade(req, socket, head);
      return;
    }

    void handleRelayUpgrade(req, socket, head);
  });

  async function handleRelayUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const slug = relaySlug(url.pathname);
    if (!slug) {
      rejectUpgrade(socket, 404, "Relay endpoint not found");
      return;
    }

    let mapping: Awaited<ReturnType<typeof prisma.mapping.findUnique>>;
    try {
      mapping = await prisma.mapping.findUnique({ where: { slug } });
    } catch (err) {
      console.error(err);
      rejectUpgrade(socket, 502, "Failed to look up relay");
      return;
    }

    if (!mapping) {
      rejectUpgrade(socket, 404, "Relay endpoint not found");
      return;
    }

    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    if (!mapping.isActive) {
      rejectUpgrade(socket, 503, "Relay endpoint is disabled");
      void saveLog({
        mappingId: mapping.id,
        method: "WS",
        path: url.pathname,
        headers: {},
        body: null,
        queryParams,
        statusCode: 503,
        success: false,
        error: "Relay endpoint is disabled",
        duration: 0,
        logRetain: mapping.logRetain,
      }).catch((err) => console.error(err));
      return;
    }

    if (!mapping.isWebSocket) {
      rejectUpgrade(socket, 400, "This relay is HTTP only");
      void saveLog({
        mappingId: mapping.id,
        method: "WS",
        path: url.pathname,
        headers: {},
        body: null,
        queryParams,
        statusCode: 400,
        success: false,
        error: "This relay is HTTP only",
        duration: 0,
        logRetain: mapping.logRetain,
      }).catch((err) => console.error(err));
      return;
    }

    relayWebSocket(req, socket, head, mapping.targetUrl, (result) => {
      void saveLog({
        mappingId: mapping.id,
        method: "WS",
        path: url.pathname,
        headers: result.headers,
        body: null,
        queryParams: result.queryParams,
        statusCode: result.opened ? 101 : null,
        success: result.opened,
        error: result.error,
        duration: result.durationMs,
        logRetain: mapping.logRetain,
      }).catch((err) => console.error(err));
    });
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`WebhookRelay ${dev ? "dev" : "prod"} on http://localhost:${port} (ws upgrades on /r/:slug)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
