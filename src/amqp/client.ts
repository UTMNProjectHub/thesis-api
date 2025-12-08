import * as amqp from "amqplib";
import { QUEUES } from "./queues";

type MessageHandler = (message: any) => Promise<void> | void;

class AMQPClient {
  private static instance: AMQPClient | null = null;
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private isConnecting: boolean = false;
  private consumers: Map<string, amqp.ConsumeMessage> = new Map();

  private constructor() {}

  static getInstance(): AMQPClient {
    if (!AMQPClient.instance) {
      AMQPClient.instance = new AMQPClient();
    }
    return AMQPClient.instance;
  }

  async connect(): Promise<void> {
    if (this.connection && this.connection.readyState === "open") {
      return;
    }

    if (this.isConnecting) {
      // Wait for connection to be established
      while (this.isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isConnecting = true;

    try {
      const amqpUrl = process.env.AMQP_URL;
      if (!amqpUrl) {
        throw new Error("AMQP_URL environment variable is not set");
      }

      this.connection = await amqp.connect(amqpUrl);
      this.channel = await this.connection.createChannel();

      this.connection.on("error", (err) => {
        console.error("AMQP connection error:", err);
        this.connection = null;
        this.channel = null;
      });

      this.connection.on("close", () => {
        console.log("AMQP connection closed, attempting to reconnect...");
        this.connection = null;
        this.channel = null;
        this.isConnecting = false;
        // Attempt to reconnect after a delay
        setTimeout(() => this.connect(), 5000);
      });

      // Assert all queues exist
      await this.assertQueues();

      console.log("✅ AMQP connected");
    } catch (error) {
      console.error("Failed to connect to AMQP:", error);
      this.connection = null;
      this.channel = null;
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private async assertQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error("Channel is not initialized");
    }

    const queueNames = Object.values(QUEUES);
    for (const queueName of queueNames) {
      await this.channel.assertQueue(queueName, {
        durable: true,
      });
    }
  }

  async publishToQueue(queueName: string, message: any): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    if (!this.channel) {
      throw new Error("Channel is not available");
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const published = this.channel.sendToQueue(queueName, messageBuffer, {
        persistent: true,
      });

      if (!published) {
        throw new Error(`Failed to publish message to queue ${queueName}`);
      }

      console.log(`📤 Published message to queue: ${queueName}`);
    } catch (error) {
      console.error(`Error publishing to queue ${queueName}:`, error);
      throw error;
    }
  }

  async consumeFromQueue(
    queueName: string,
    handler: MessageHandler,
  ): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    if (!this.channel) {
      throw new Error("Channel is not available");
    }

    try {
      // Assert queue exists
      await this.channel.assertQueue(queueName, {
        durable: true,
      });

      await this.channel.consume(
        queueName,
        async (msg) => {
          if (!msg) {
            return;
          }

          try {
            let content;
            try {
              content = JSON.parse(msg.content.toString());
            } catch (parseError) {
              console.error(
                `❌ Invalid JSON message from ${queueName}, ignoring:`,
                parseError instanceof Error ? parseError.message : parseError,
              );
              // ack to remove shite out of the queue
              this.channel?.ack(msg);
              return;
            }

            await handler(content);
            this.channel?.ack(msg);
          } catch (error) {
            console.error(
              `❌ Error processing message from ${queueName}:`,
              error instanceof Error ? error.message : error,
            );
            // Acknowledge to remove the message from queue (don't requeue bad messages)
            this.channel?.ack(msg);
          }
        },
        {
          noAck: false,
        },
      );

      console.log(`👂 Consuming from queue: ${queueName}`);
    } catch (error) {
      console.error(`Error consuming from queue ${queueName}:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    this.consumers.clear();
    console.log("AMQP disconnected");
  }
}

export const amqpClient = AMQPClient.getInstance();

