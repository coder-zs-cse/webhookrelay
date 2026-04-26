import { NextRequest } from "next/server";
import { eventBus } from "@/lib/eventBus";
import { RequestLog } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const stream = new ReadableStream({
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
        const encoder = new TextEncoder();
        const listener = (log: RequestLog) => {
            controller.enqueue(
            encoder.encode(`event: request\ndata: ${JSON.stringify(log)}\n\n`)
            );
        };
        eventBus.on(`webhook:${id}`, listener);

        controller.enqueue(encoder.encode(`event: open\n\n`));

        req.signal.addEventListener("abort", () => {
            eventBus.off(`webhook:${id}`, listener);
            controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}