/** Rewrite an HTTP(S) or WS(S) target and merge the caller's query string onto it. */
export function toUpstreamWebSocketUrl(targetUrl: string, incomingSearch: string): string {
  const target = new URL(targetUrl);

  if (target.protocol === "https:") target.protocol = "wss:";
  else if (target.protocol === "http:") target.protocol = "ws:";
  else if (target.protocol !== "wss:" && target.protocol !== "ws:") {
    throw new Error("WebSocket target must use http, https, ws, or wss");
  }

  const incoming = new URLSearchParams(
    incomingSearch.startsWith("?") ? incomingSearch.slice(1) : incomingSearch
  );
  incoming.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  return target.toString();
}
