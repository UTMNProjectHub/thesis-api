export interface WebSocket {
  send(data: string | Buffer): number;
  readyState: number;
  data: { topic?: string; [key: string]: any };
  close(code?: number, reason?: string): void;
}

export class WebSocketManager {
  private subscriptions: Map<string, Set<WebSocket>> = new Map();

  subscribe(ws: WebSocket, topic: string): void {
    console.log(`📡 WebSocket requested to subscribe to topic: ${topic}`);
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }

    this.subscriptions.get(topic)!.add(ws);
    ws.data.topic = topic;

    console.log(`📡 WebSocket subscribed to topic: ${topic}`);
  }

  unsubscribe(ws: WebSocket, topic?: string): void {
    const targetTopic = topic || ws.data.topic;
    if (!targetTopic) {
      return;
    }

    const subscribers = this.subscriptions.get(targetTopic);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.subscriptions.delete(targetTopic);
      }
      console.log(`📡 WebSocket unsubscribed from topic: ${targetTopic}`);
    }
  }

  broadcast(topic: string, message: any): void {
    const subscribers = this.subscriptions.get(topic);
    if (!subscribers || subscribers.size === 0) {
      console.log(`⚠️ No subscribers for topic: ${topic}`);
      return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    subscribers.forEach((ws) => {
      try {
        if (ws.readyState === 1) {
          ws.send(messageStr);
          sentCount++;
        } else {
          subscribers.delete(ws);
        }
      } catch (error) {
        console.error(`Error sending message to WebSocket:`, error);
        subscribers.delete(ws);
      }
    });

    console.log(
      `📤 Broadcasted message to ${sentCount} subscribers on topic: ${topic}`,
    );
  }

  removeConnection(ws: WebSocket): void {
    this.subscriptions.forEach((subscribers, topic) => {
      if (subscribers.has(ws)) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          this.subscriptions.delete(topic);
        }
        console.log(`📡 Removed WebSocket connection from topic: ${topic}`);
      }
    });

    ws.data.topic = undefined;
  }

  getSubscriberCount(topic: string): number {
    return this.subscriptions.get(topic)?.size || 0;
  }

  getAllTopics(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

export const wsManager = new WebSocketManager();

