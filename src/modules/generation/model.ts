import { t } from "elysia";

export const QuizGenBody = t.Object({
  files: t.Array(t.String({ format: "uuid" })),
  themeId: t.String({ format: "uuid" }),
  difficulty: t.Union([
    t.Literal("easy"),
    t.Literal("medium"),
    t.Literal("hard"),
  ]),
  question_count: t.Number({ minimum: 1 }),
  question_types: t.Array(
    t.Union([
      t.Literal("multichoice"),
      t.Literal("essay"),
      t.Literal("matching"),
      t.Literal("truefalse"),
      t.Literal("shortanswer"),
      t.Literal("numerical"),
    ]),
  ),
  additional_requirements: t.Optional(t.String()),
});

export const SummaryGenBody = t.Object({
  subjectId: t.Number(),
  themeId: t.Number(),
  files: t.Array(t.String({ format: "uuid" })),
  additional_requirements: t.Optional(t.String()),
});

export const QuizGenComplete = t.Object({
  quizId: t.String({ format: "uuid" }),
  status: t.Union([t.Literal("SUCCESS"), t.Literal("FAILED")]),
  error: t.Optional(t.String()),
});

export const SummaryGenComplete = t.Object({
  summaryId: t.String({ format: "uuid" }),
  subjectId: t.Number(),
  themeId: t.Number(),
  status: t.Union([t.Literal("SUCCESS"), t.Literal("FAILED")]),
  error: t.Optional(t.String()),
});

export const GenerationModel = {
  quizGenBody: QuizGenBody,
  summaryGenBody: SummaryGenBody,
  quizGenComplete: QuizGenComplete,
  summaryGenComplete: SummaryGenComplete,
};

