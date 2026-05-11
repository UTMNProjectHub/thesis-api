import { QuizService } from "../quiz/service";

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function cdata(str: string): string {
	return `<![CDATA[${str.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

type Variant = {
	id: string;
	text: string;
	leftMatching: string | null;
	rightMatching: string | null;
	explainRight: string;
	explainWrong: string;
	isRight: boolean;
	questionId: string;
	variantId: string;
	questionsVariantsId: string;
};

type Question = {
	id: string;
	type: string;
	multiAnswer: boolean | null;
	text: string;
	variants: Variant[];
};

function buildMultichoice(q: Question): string {
	const single = !q.multiAnswer;
	const answers = q.variants
		.map((v) => {
			const fraction = v.isRight ? 100 : 0;
			const feedback = v.isRight ? v.explainRight : v.explainWrong;
			return `    <answer fraction="${fraction}" format="html">
      <text>${cdata(v.text)}</text>
      <feedback format="html"><text>${cdata(feedback)}</text></feedback>
    </answer>`;
		})
		.join("\n");

	return `  <question type="multichoice">
    <name><text>${escapeXml(q.text.slice(0, 80))}</text></name>
    <questiontext format="html"><text>${cdata(q.text)}</text></questiontext>
    <single>${single ? "true" : "false"}</single>
    <shuffleanswers>1</shuffleanswers>
${answers}
  </question>`;
}

function buildTruefalse(q: Question): string {
	const answers = q.variants
		.map((v) => {
			const isTrue = v.text.toLowerCase().includes("ист") || v.text.toLowerCase() === "true";
			const fraction = v.isRight ? 100 : 0;
			const feedback = v.isRight ? v.explainRight : v.explainWrong;
			return `    <answer fraction="${fraction}" format="html">
      <text>${escapeXml(isTrue ? "true" : "false")}</text>
      <feedback format="html"><text>${cdata(feedback)}</text></feedback>
    </answer>`;
		})
		.join("\n");

	return `  <question type="truefalse">
    <name><text>${escapeXml(q.text.slice(0, 80))}</text></name>
    <questiontext format="html"><text>${cdata(q.text)}</text></questiontext>
${answers}
  </question>`;
}

function buildShortanswer(q: Question): string {
	const answers = q.variants
		.filter((v) => v.isRight)
		.map((v) => {
			return `    <answer fraction="100" format="html">
      <text>${escapeXml(v.text)}</text>
      <feedback format="html"><text>${cdata(v.explainRight)}</text></feedback>
    </answer>`;
		})
		.join("\n");

	return `  <question type="shortanswer">
    <name><text>${escapeXml(q.text.slice(0, 80))}</text></name>
    <questiontext format="html"><text>${cdata(q.text)}</text></questiontext>
    <usecase>0</usecase>
${answers}
  </question>`;
}

function buildMatching(q: Question): string {
	const subquestions = q.variants
		.map((v) => {
			const left = v.leftMatching ?? v.text;
			const right = v.rightMatching ?? "";
			return `    <subquestion format="html">
      <text>${cdata(left)}</text>
      <answer><text>${escapeXml(right)}</text></answer>
    </subquestion>`;
		})
		.join("\n");

	return `  <question type="matching">
    <name><text>${escapeXml(q.text.slice(0, 80))}</text></name>
    <questiontext format="html"><text>${cdata(q.text)}</text></questiontext>
    <shuffleanswers>true</shuffleanswers>
${subquestions}
  </question>`;
}

function buildEssay(q: Question): string {
	return `  <question type="essay">
    <name><text>${escapeXml(q.text.slice(0, 80))}</text></name>
    <questiontext format="html"><text>${cdata(q.text)}</text></questiontext>
    <responseformat>editor</responseformat>
    <responserequired>1</responserequired>
    <responsefieldlines>15</responsefieldlines>
  </question>`;
}

function buildNumerical(q: Question): string {
	const answers = q.variants
		.filter((v) => v.isRight)
		.map((v) => {
			return `    <answer fraction="100">
      <text>${escapeXml(v.text)}</text>
      <tolerance>0.0001</tolerance>
      <feedback format="html"><text>${cdata(v.explainRight)}</text></feedback>
    </answer>`;
		})
		.join("\n");

	return `  <question type="numerical">
    <name><text>${escapeXml(q.text.slice(0, 80))}</text></name>
    <questiontext format="html"><text>${cdata(q.text)}</text></questiontext>
${answers}
  </question>`;
}

function buildDescription(q: Question): string {
	return `  <question type="description">
    <name><text>${escapeXml(q.text.slice(0, 80))}</text></name>
    <questiontext format="html"><text>${cdata(q.text)}</text></questiontext>
  </question>`;
}

function questionToXml(q: Question): string {
	switch (q.type) {
		case "multichoice":
			return buildMultichoice(q);
		case "truefalse":
			return buildTruefalse(q);
		case "shortanswer":
			return buildShortanswer(q);
		case "matching":
			return buildMatching(q);
		case "essay":
			return buildEssay(q);
		case "numerical":
			return buildNumerical(q);
		case "description":
			return buildDescription(q);
		default:
			return buildDescription(q);
	}
}

export class ExportService {
	private quizService: QuizService;

	constructor() {
		this.quizService = new QuizService();
	}

	async exportQuizToMoodleXml(quizId: string): Promise<string> {
		const quiz = await this.quizService.getQuizById(quizId);
		const questions = await this.quizService.getQuestionsWithVariantsByQuizId(quizId);

		const questionXmls = questions.map((q) => questionToXml(q as Question));

		return [
			'<?xml version="1.0" encoding="UTF-8"?>',
			"<quiz>",
			...questionXmls,
			"</quiz>",
		].join("\n");
	}
}
