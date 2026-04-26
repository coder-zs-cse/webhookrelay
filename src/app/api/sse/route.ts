//data:     the actual payload
//event:    custom event name (optional)
//id:       message ID (optional)
//retry:    reconnection delay in ms (optional)


// api/sse/route.ts
export async function GET(request: Request) {
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  };

  // stop interval after 10 seconds
  let interval: NodeJS.Timeout | null = null;
  const startTime = Date.now();
  return new Response(new ReadableStream({
    start(controller) {
      interval = setInterval(() => {
        if (Date.now() - startTime > 60000) {
          controller.enqueue("event: done\ndata: stream ended\n\n");
          controller.close();
          if (interval) {
            clearInterval(interval);
          }
          return;
        }
        controller.enqueue("data: Hello, world! at " + new Date().toISOString() + "\n\n");
      }, 1000);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }
    },
  }), { headers });
}