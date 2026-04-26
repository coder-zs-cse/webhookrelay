import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventBus } from "@/lib/eventBus";
import { RequestLog } from "@prisma/client";
import { config } from "@/lib/config";

// Headers we should NOT forward to the target (hop-by-hop headers)
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

async function handleRelay(req: NextRequest, slug: string): Promise<NextResponse> {
  const startTime = Date.now();

  // Look up the mapping
  const mapping = await prisma.mapping.findUnique({ where: { slug } });

  if (!mapping) {
    return NextResponse.json({ error: "Relay endpoint not found" }, { status: 404 });
  }

  if (!mapping.isActive) {
    return NextResponse.json({ error: "Relay endpoint is disabled" }, { status: 503 });
  }

  // Build the forwarded URL: targetUrl + original search params
  const incomingUrl = new URL(req.url);
  const targetUrl = new URL(mapping.targetUrl);

  // Append incoming query params to target URL
  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  // Collect headers to forward (filter hop-by-hop)
  const forwardHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  });

  // Add relay identification headers
  forwardHeaders["x-forwarded-host"] = incomingUrl.hostname;
  forwardHeaders["x-relay-slug"] = slug;

  forwardHeaders["ngrok-skip-browser-warning"] = "true";
  forwardHeaders["user-agent"] = "WebhookRelay/1.0";
  
  // Read request body
  let bodyText: string | null = null;
  let bodyJson: unknown = null;
  const method = req.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    try {
      bodyText = await req.text();
      if (bodyText) {
        try {
          bodyJson = JSON.parse(bodyText);
        } catch {
          bodyJson = bodyText;
        }
      }
    } catch {
      // ignore body read errors
    }
  }

  // Capture query params for logging
  const queryParams: Record<string, string> = {};
  incomingUrl.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  let statusCode: number | null = null;
  let success = false;
  let errorMessage: string | null = null;
  let responseBody: string | null = null;
  let responseHeaders: Record<string, string> = {};

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: forwardHeaders,
      ...(bodyText ? { body: bodyText } : {}),
      // Don't follow redirects automatically
      redirect: "manual",
    };

    const response = await fetch(targetUrl.toString(), fetchOptions);
    statusCode = response.status;
    success = response.status < 500;

    // Collect response headers
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    try {
      responseBody = await response.text();
    } catch {
      // ignore
    }

    // Forward the response back to caller
    const relayResponse = mapping.alwaysReturn200
  ? new NextResponse("Success", {
      status: 200,
      headers: { "x-relay-slug": slug, "x-relay-target": mapping.targetUrl },
    })
  : new NextResponse(responseBody, {
      status: response.status,
      headers: {
        ...responseHeaders,
        "x-relay-slug": slug,
        "x-relay-target": mapping.targetUrl,
      },
    });

    // Save log async (don't await — don't block the response)
    saveLog({
      mappingId: mapping.id,
      method,
      path: incomingUrl.pathname,
      headers: forwardHeaders,
      body: bodyJson,
      queryParams,
      statusCode,
      success,
      error: null,
      duration: Date.now() - startTime,
      logRetain: mapping.logRetain,
    }).catch(console.error);

    return relayResponse;
  } catch (err) {
    statusCode = null;
    success = false;
    errorMessage =
      err instanceof Error ? err.message : "Failed to reach target URL";

    // Save failed log
    saveLog({
      mappingId: mapping.id,
      method,
      path: incomingUrl.pathname,
      headers: forwardHeaders,
      body: bodyJson,
      queryParams,
      statusCode: null,
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
      logRetain: mapping.logRetain,
    }).catch(console.error);

    return NextResponse.json(
      { error: "Failed to reach target", detail: errorMessage },
      { status: 502 }
    );
  }
}

async function saveLog(params: {
  mappingId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  queryParams: Record<string, string>;
  statusCode: number | null;
  success: boolean;
  error: string | null;
  duration: number;
  logRetain: number;
}) {
  // Insert new log
  const currentLog: RequestLog = await prisma.requestLog.create({
    data: {
      mappingId: params.mappingId,
      method: params.method,
      path: params.path,
      headers: params.headers,
      body: params.body ?? undefined,
      queryParams: params.queryParams,
      statusCode: params.statusCode,
      success: params.success,
      error: params.error,
      duration: params.duration,
    },
  });

  if (config.enableSSE) {
    eventBus.emit(`webhook:${params.mappingId}`, currentLog);
  }

  // Trim to logRetain limit — keep only the N most recent
  const logs = await prisma.requestLog.findMany({
    where: { mappingId: params.mappingId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (logs.length > params.logRetain) {
    const toDelete = logs.slice(params.logRetain).map((l: { id: string }) => l.id);
    await prisma.requestLog.deleteMany({ where: { id: { in: toDelete } } });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleRelay(req, slug);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleRelay(req, slug);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleRelay(req, slug);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleRelay(req, slug);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleRelay(req, slug);
}

export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleRelay(req, slug);
}

export async function OPTIONS(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleRelay(req, slug);
}
