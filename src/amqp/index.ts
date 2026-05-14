import { user } from "../modules/user";
import { wsManager } from "../modules/websocket/manager";
import { amqpClient } from "./client";
import { QUEUES } from "./queues";
import {
	FaqGenCompleteMessage,
	QuizAnswerDialogCompleteMessage,
	QuizGenCompleteMessage,
	SummaryGenCompleteMessage,
} from "./types";

export async function initializeAMQP() {
	try {
		await amqpClient.connect();

		// Subscribe to quiz generation complete queue
		await amqpClient.consumeFromQueue<QuizGenCompleteMessage>(
			QUEUES.QUIZ_GENERATION_COMPLETE,
			async (message) => {
				const { quizId, userId, status, error } = message;
				const topic = `user.${userId}`;

				console.log(
					`📨 Received quiz generation complete for quizId: ${quizId}, status: ${status}, error: ${error}`,
				);

				wsManager.broadcast(topic, message);
			},
		);

		// Subscribe to summary generation complete queue
		await amqpClient.consumeFromQueue<SummaryGenCompleteMessage>(
			QUEUES.SUMMARY_GENERATION_COMPLETE,
			async (message) => {
				const { summaryId, userId, status, error } = message;
				const topic = `user.${userId}`;

				console.log(
					`📨 Received summary generation complete for summaryId: ${summaryId}, status: ${status}, error: ${error}`,
				);

				wsManager.broadcast(topic, message);
			},
		);

		// Subscribe to FAQ generation complete queue
		await amqpClient.consumeFromQueue<FaqGenCompleteMessage>(
			QUEUES.FAQ_GENERATION_COMPLETE,
			async (message) => {
				const { faqId, userId, status, error } = message;
				const topic = `user.${userId}`;

				console.log(
					`📨 Received FAQ generation complete for faqId: ${faqId}, status: ${status}, error: ${error}`,
				);

				wsManager.broadcast(topic, message);
			},
		);

		await amqpClient.consumeFromQueue<QuizAnswerDialogCompleteMessage>(
			QUEUES.QUIZ_ANSWER_DIALOG_RESPONSE,
			async (message) => {
				const { dialogId, userId, status, error } = message;
				const topic = `user.${userId}`;

				console.log(
					`📨 Received FAQ generation complete for QuizDialog: ${dialogId}, status: ${status}, error: ${error}`,
				);

				wsManager.broadcast(topic, message);
			},
		);

		console.log("✅ AMQP bridge initialized");
	} catch (error) {
		console.error("Failed to initialize AMQP bridge:", error);
		throw error;
	}
}
