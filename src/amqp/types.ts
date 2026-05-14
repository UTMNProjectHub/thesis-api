export interface QuizGenCompleteMessage {
	quizId: string; //uuid,
	userId: string;
	status: "SUCCESS" | "FAILED";
	error?: string;
}

export interface SummaryGenCompleteMessage {
	summaryId: string; // uuid
	subjectId: number;
	themeId: number;
	userId: string; // uuid
	status: "SUCCESS" | "FAILED";
	error?: string;
}

export interface FaqGenCompleteMessage {
	faqId: string; // uuid
	userId: string; // uuid
	status: "SUCCESS" | "FAILED";
	error?: string;
}

export interface QuizAnswerDialogMessage {
	dialogId: string; // uuid
	userId: string; // uuid
	messageId: string; // uuid
}

export interface QuizAnswerDialogCompleteMessage {
	status: "SUCCESS" | "FAILED";
	dialogId: string; // uuid
	userId: string; // uuid
	error?: string;
}
