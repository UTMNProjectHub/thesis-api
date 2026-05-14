import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockGetQuizById = mock();
const mockGetQuestionsWithVariantsByQuizId = mock();

mock.module("../../quiz/service", () => ({
	QuizService: class {
		getQuizById = mockGetQuizById;
		getQuestionsWithVariantsByQuizId = mockGetQuestionsWithVariantsByQuizId;
	},
}));

// Also mock session service dep used by QuizService
mock.module("../../../db", () => ({ db: {} }));

import { ExportService } from "../service";

const makeVariant = (overrides = {}) => ({
	id: "v1",
	text: "Variant text",
	leftMatching: null,
	rightMatching: null,
	explainRight: "Correct!",
	explainWrong: "Wrong!",
	isRight: true,
	questionId: "q1",
	variantId: "v1",
	questionsVariantsId: "qv1",
	...overrides,
});

const makeQuestion = (type: string, overrides = {}) => ({
	id: "q1",
	type,
	multiAnswer: null,
	text: "Sample question text",
	variants: [makeVariant()],
	...overrides,
});

describe("ExportService", () => {
	let exportService: ExportService;

	beforeEach(() => {
		exportService = new ExportService();
		mockGetQuizById.mockReset();
		mockGetQuestionsWithVariantsByQuizId.mockReset();
	});

	it("should produce valid XML structure", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test Quiz" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("essay"),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
		expect(xml).toContain("<quiz>");
		expect(xml).toContain("</quiz>");
		expect(xml).toContain('<question type="essay">');
	});

	it("should build multichoice question XML", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test Quiz" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("multichoice", {
				multiAnswer: false,
				variants: [
					makeVariant({ text: "Correct", isRight: true }),
					makeVariant({ id: "v2", text: "Wrong", isRight: false }),
				],
			}),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain('<question type="multichoice">');
		expect(xml).toContain("<single>true</single>");
		expect(xml).toContain('fraction="100"');
		expect(xml).toContain('fraction="0"');
	});

	it("should set single=false for multi-answer multichoice", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("multichoice", { multiAnswer: true }),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain("<single>false</single>");
	});

	it("should build truefalse question XML", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("truefalse", {
				variants: [makeVariant({ text: "Истина", isRight: true })],
			}),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain('<question type="truefalse">');
		expect(xml).toContain("<text>true</text>");
	});

	it("should build shortanswer question XML", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("shortanswer", {
				variants: [makeVariant({ text: "correct answer", isRight: true })],
			}),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain('<question type="shortanswer">');
		expect(xml).toContain('fraction="100"');
		expect(xml).toContain("correct answer");
	});

	it("should only include correct variants in shortanswer", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("shortanswer", {
				variants: [
					makeVariant({ text: "right", isRight: true }),
					makeVariant({ id: "v2", text: "wrong", isRight: false }),
				],
			}),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain("right");
		expect(xml).not.toContain(">wrong<");
	});

	it("should build matching question XML", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("matching", {
				variants: [
					makeVariant({ leftMatching: "A", rightMatching: "1" }),
					makeVariant({ id: "v2", leftMatching: "B", rightMatching: "2" }),
				],
			}),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain('<question type="matching">');
		expect(xml).toContain("<subquestion");
		expect(xml).toContain("<![CDATA[A]]>");
	});

	it("should build essay question XML", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("essay"),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain('<question type="essay">');
		expect(xml).toContain("<responseformat>editor</responseformat>");
		expect(xml).toContain("<responsefieldlines>15</responsefieldlines>");
	});

	it("should build numerical question XML", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("numerical", {
				variants: [makeVariant({ text: "42", isRight: true })],
			}),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain('<question type="numerical">');
		expect(xml).toContain("<tolerance>0.0001</tolerance>");
		expect(xml).toContain("<text>42</text>");
	});

	it("should build description question XML", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("description"),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain('<question type="description">');
	});

	it("should fall back to description for unknown question types", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("unknown_type"),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain('<question type="description">');
	});

	it("should escape XML special characters in question names", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("essay", { text: 'A & B < C > D "E" \'F\'' }),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain("A &amp; B &lt; C &gt; D &quot;E&quot; &apos;F&apos;");
	});

	it("should wrap question text in CDATA", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([
			makeQuestion("essay", { text: "Question with <html> content" }),
		]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain("<![CDATA[Question with <html> content]]>");
	});

	it("should handle empty questions list", async () => {
		mockGetQuizById.mockResolvedValue({ id: "quiz1", name: "Test" });
		mockGetQuestionsWithVariantsByQuizId.mockResolvedValue([]);

		const xml = await exportService.exportQuizToMoodleXml("quiz1");

		expect(xml).toContain("<quiz>");
		expect(xml).toContain("</quiz>");
	});
});
