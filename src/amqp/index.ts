import { amqpClient } from "./client";
import { QUEUES } from "./queues";
import { wsManager } from "../modules/websocket/manager";

export async function initializeAMQP() {
  try {
    await amqpClient.connect();

    // Subscribe to quiz generation complete queue
    await amqpClient.consumeFromQueue(
      QUEUES.QUIZ_GENERATION_COMPLETE,
      async (message) => {
        const { quizId, status, error } = message;
        const topic = `quiz.${quizId}.generation`;

        console.log(
          `📨 Received quiz generation complete for quizId: ${quizId}, status: ${status}`,
        );

        wsManager.broadcast(topic, {
          quizId,
          status,
          error,
        });
      },
    );

    // Subscribe to summary generation complete queue
    await amqpClient.consumeFromQueue(
      QUEUES.SUMMARY_GENERATION_COMPLETE,
      async (message) => {
        const { summaryId, subjectId, themeId, status, error } = message;
        const topic = `summary.${summaryId}.generation`;

        console.log(
          `📨 Received summary generation complete for summaryId: ${summaryId}, status: ${status}`,
        );

        wsManager.broadcast(topic, {
          summaryId,
          subjectId,
          themeId,
          status,
          error,
        });
      },
    );

    console.log("✅ AMQP bridge initialized");
  } catch (error) {
    console.error("Failed to initialize AMQP bridge:", error);
    throw error;
  }
}

