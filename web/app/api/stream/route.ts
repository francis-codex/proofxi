/**
 * Genuine Server-Sent-Events endpoint. Replays the TxLINE scores-stream for
 * fixture 18257865 as real SSE (text/event-stream) so the client consumes it
 * with a native EventSource — the same transport TxLINE's live scores use.
 * Data is replayed (allowed for the demo); the connection is real.
 */

import { FEED, TICK_MS } from "@/lib/matchFeed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The replay stream runs ~7s; give generous headroom so a serverless
// function timeout can never truncate the live SSE feed on Vercel.
export const maxDuration = 30;

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // handshake — mirrors the stream opening with the fixture context
      send("open", {
        fixtureId: 18257865,
        source: "TxLINE · scores stream (replay)",
        ts: Date.now(),
      });

      for (const tick of FEED) {
        await new Promise((r) => setTimeout(r, TICK_MS));
        send(tick.final ? "final" : "tick", { ...tick, ts: Date.now() });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
