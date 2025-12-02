import { Elysia } from "elysia";
import { wsManager } from "./manager";

export const websocket = new Elysia()
  .ws("/ws", {
    open(ws) {
      const topic = ws.data.query?.topic as string | undefined;

      if (topic) {
        const rawWs = ws.raw;
        wsManager.subscribe(rawWs, topic);
      } else {
        console.warn("WebSocket connected without topic parameter");
        ws.close(1008, "Topic parameter is required");
      }
    },
    message(ws, message) {
      try {
        const data = JSON.parse(message as string);
        console.log("WebSocket message received:", data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    },
    close(ws) {
      const rawWs = ws.raw;
      wsManager.removeConnection(rawWs);
    },
  });
