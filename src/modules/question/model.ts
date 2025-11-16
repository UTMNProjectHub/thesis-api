import { t } from "elysia";

// Question type enum
export const QuestionType = t.Union([
  t.Literal("multichoice"),
  t.Literal("truefalse"),
  t.Literal("shortanswer"),
  t.Literal("matching"),
  t.Literal("essay"),
  t.Literal("numerical"),
  t.Literal("description"),
]);

// Request Models
export const SolveQuestionParams = t.Object({
  id: t.String({ format: "uuid" }),
});

export const SolveQuestionBody = t.Object({
  answerIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
  answerText: t.Optional(t.String()),
  quizId: t.String({ format: "uuid" }),
});

// Base Models
export const QuestionModel = t.Object({
  id: t.String({ format: "uuid" }),
  type: t.String(), // QuestionType would be more strict, but DB returns string
  multiAnswer: t.Nullable(t.Boolean()),
  text: t.String(),
});

export const VariantModel = t.Object({
  id: t.String({ format: "uuid" }),
  text: t.String(),
  explainRight: t.String(),
  explainWrong: t.String(),
  isRight: t.Boolean(),
  questionId: t.String({ format: "uuid" }),
  variantId: t.String({ format: "uuid" }),
  questionsVariantsId: t.String({ format: "uuid" }),
});

export const SubmittedVariantResponse = t.Object({
  variantId: t.String({ format: "uuid" }),
  variantText: t.String(),
  isRight: t.Boolean(),
  explanation: t.String(),
});

export const MatchingPairResponse = t.Object({
  key: t.String(),
  value: t.String(),
  isRight: t.Boolean(),
  explanation: t.Nullable(t.String()),
});

export const ChosenVariantModel = t.Object({
  id: t.String({ format: "uuid" }),
  userId: t.String({ format: "uuid" }),
  quizId: t.String({ format: "uuid" }),
  questionId: t.String({ format: "uuid" }),
  chosenId: t.Nullable(t.String({ format: "uuid" })),
  answer: t.Nullable(t.Any()),
  isRight: t.Nullable(t.Boolean()),
});

// Response Models
export const SolveQuestionVariantsResponse = t.Object({
  question: QuestionModel,
  submittedVariants: t.Array(SubmittedVariantResponse),
  allVariants: t.Array(VariantModel),
});

// Response for matching questions
export const SolveQuestionMatchingResponse = t.Object({
  question: QuestionModel,
  submittedAnswer: ChosenVariantModel,
  isRight: t.Nullable(t.Boolean()),
  pairs: t.Array(MatchingPairResponse),
  variants: t.Array(VariantModel),
  explanation: t.Optional(t.Nullable(t.String())),
});

// Response for other text questions (shortanswer, essay, numerical)
export const SolveQuestionTextResponse = t.Object({
  question: QuestionModel,
  submittedAnswer: ChosenVariantModel,
  isRight: t.Nullable(t.Boolean()),
  explanation: t.Nullable(t.String()),
  variants: t.Array(VariantModel),
  pairs: t.Optional(t.Array(MatchingPairResponse)),
});

// Union of all text question responses
export const SolveQuestionTextResponseUnion = t.Union([
  SolveQuestionMatchingResponse,
  SolveQuestionTextResponse,
]);

// Error Response
export const ErrorResponse = t.String();

// Update Models
export const UpdateQuestionBody = t.Object({
  text: t.Optional(t.String()),
  type: t.Optional(QuestionType),
  multiAnswer: t.Optional(t.Nullable(t.Boolean())),
});

export const UpdateQuestionVariant = t.Object({
  text: t.String(),
  explainRight: t.String(),
  explainWrong: t.String(),
  isRight: t.Boolean(),
});

export const UpdateQuestionVariantsBody = t.Object({
  variants: t.Array(UpdateQuestionVariant),
});

