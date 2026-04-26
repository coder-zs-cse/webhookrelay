"use client";

import { useEffect, useState } from "react";

export default function SSEPage() {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const eventSource = new EventSource("/api/sse");
    eventSource.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    eventSource.addEventListener("done", () => {
        console.log("server said we're done");
        eventSource.close(); // THIS sets readyState to CLOSED
    });

    eventSource.onerror = (event) => {
      console.error("error in SSE", event);
      console.error("event source", eventSource);
       // check readyState:
        // 0 = CONNECTING (it's retrying)
        // 1 = OPEN (connected)
        // 2 = CLOSED (done)

        if (eventSource.readyState === EventSource.CLOSED) {
            console.log("connection was closed by server");
        }

        // if you want to stop retrying entirely:
        // eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div>
      <h1>SSE</h1>
      <p>{messages.join("\n")}</p>
    </div>
  );
}