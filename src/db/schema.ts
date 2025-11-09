import { relations } from "drizzle-orm";
import {
  pgSchema,
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  text,
  boolean,
  json,
} from "drizzle-orm/pg-core";

export const thesisSchema = pgSchema("thesis");

export const users = thesisSchema.table("users", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: varchar().unique().notNull(),
  full_name: varchar(),
  avatar_url: varchar(),
  password: varchar().notNull(),
  date_created: timestamp().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  usersToRoles: many(usersToRoles),
  usersQuizes: many(usersQuizes),
  chosenVariants: many(chosenVariants),
  referencesQuiz: many(referencesQuiz),
  files: many(files),
  quizSessions: many(quizSession),
}));

export const usersToRoles = thesisSchema.table("users_roles", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  roleId: integer()
    .notNull()
    .references(() => roles.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const usersToRolesRelations = relations(usersToRoles, ({ one }) => ({
  user: one(users, {
    fields: [usersToRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [usersToRoles.roleId],
    references: [roles.id],
  }),
}));

export const roles = thesisSchema.table("roles", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  title: varchar().notNull(),
  slug: varchar().unique().notNull(),
  description: varchar(),
  date_created: timestamp(),
});

export const rolesRelations = relations(roles, ({ many }) => ({
  rolesToPermissions: many(rolesToPermissions),
  usersToRoles: many(usersToRoles),
}));

export const rolesToPermissions = thesisSchema.table("roles_permissions", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  roleId: integer()
    .notNull()
    .references(() => roles.id, { onUpdate: "cascade", onDelete: "cascade" }),
  permissionId: integer()
    .notNull()
    .references(() => permissions.id, {
      onUpdate: "cascade",
      onDelete: "cascade",
    }),
});

export const rolesToPermissionsRelations = relations(
  rolesToPermissions,
  ({ one }) => ({
    role: one(roles, {
      fields: [rolesToPermissions.roleId],
      references: [roles.id],
    }),
    permission: one(permissions, {
      fields: [rolesToPermissions.permissionId],
      references: [permissions.id],
    }),
  }),
);

export const permissions = thesisSchema.table("permissions", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  title: varchar(),
  slug: varchar().unique(),
  description: varchar(),
  date_created: timestamp(),
});

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolesToPermissions: many(rolesToPermissions),
}));

export const quizes = thesisSchema.table("quizes", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: varchar().notNull(),
  name: varchar().notNull(),
  maxSessions: integer().notNull().default(1),
  description: text().notNull(),
  themeId: integer().references(() => themes.id),
});

export const quizesRelations = relations(quizes, ({ one, many }) => ({
  theme: one(themes, {
    fields: [quizes.themeId],
    references: [themes.id],
  }),
  quizesQuestions: many(quizesQuestions),
  usersQuizes: many(usersQuizes),
  referencesQuiz: many(referencesQuiz),
  chosenVariants: many(chosenVariants),
  quizSessions: many(quizSession),
}));

export const questions = thesisSchema.table("questions", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: varchar().notNull(), // multichoice|truefalse|shortanswer|matching|essay|numerical|description
  multiAnswer: boolean(),
  text: text().notNull(),
});

export const questionsRelations = relations(questions, ({ many }) => ({
  quizesQuestions: many(quizesQuestions),
  questionsVariants: many(questionsVariants),
  referencesQuestion: many(referencesQuestion),
  chosenVariants: many(chosenVariants),
}));

export const quizesQuestions = thesisSchema.table("quizes_questions", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quizId: uuid()
    .notNull()
    .references(() => quizes.id),
  questionId: uuid()
    .notNull()
    .references(() => questions.id),
});

export const quizesQuestionsRelations = relations(
  quizesQuestions,
  ({ one }) => ({
    quiz: one(quizes, {
      fields: [quizesQuestions.quizId],
      references: [quizes.id],
    }),
    question: one(questions, {
      fields: [quizesQuestions.questionId],
      references: [questions.id],
    }),
  }),
);

export const usersQuizes = thesisSchema.table("users_quizes", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  quizId: uuid()
    .notNull()
    .references(() => quizes.id),
});

export const usersQuizesRelations = relations(usersQuizes, ({ one }) => ({
  user: one(users, {
    fields: [usersQuizes.userId],
    references: [users.id],
  }),
  quiz: one(quizes, {
    fields: [usersQuizes.quizId],
    references: [quizes.id],
  }),
}));

export const quizSession = thesisSchema.table("quiz_session", {
  id: uuid().primaryKey().$defaultFn(() => crypto.randomUUID()),
  quizId: uuid().notNull().references(() => quizes.id),
  userId: uuid().notNull().references(() => users.id),
  timeStart: timestamp(),
  timeEnd: timestamp(),
});

export const quizSessionRelations = relations(quizSession, ({ one, many }) => ({
  quiz: one(quizes, {
    fields: [quizSession.quizId],
    references: [quizes.id],
  }),
  user: one(users, {
    fields: [quizSession.userId],
    references: [users.id],
  }),
  sessionSubmits: many(sessionSubmits),
}));

export const sessionSubmits = thesisSchema.table("session_submits", {
  id: uuid().primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: uuid().notNull().references(() => quizSession.id),
  submitId: uuid().notNull().references(() => chosenVariants.id),
});

export const sessionSubmitsRelations = relations(sessionSubmits, ({ one }) => ({
  session: one(quizSession, {
    fields: [sessionSubmits.sessionId],
    references: [quizSession.id],
  }),
  submit: one(chosenVariants, {
    fields: [sessionSubmits.submitId],
    references: [chosenVariants.id],
  }),
}));

export const chosenVariants = thesisSchema.table("chosen_variants", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quizId: uuid()
    .notNull()
    .references(() => quizes.id),
  questionId: uuid()
    .notNull()
    .references(() => questions.id),
  chosenId: uuid().references(() => questionsVariants.id),
  answer: json(),
  isRight: boolean(),
});

export const chosenVariantsRelations = relations(chosenVariants, ({ one, many }) => ({
  quiz: one(quizes, {
    fields: [chosenVariants.quizId],
    references: [quizes.id],
  }),
  question: one(questions, {
    fields: [chosenVariants.questionId],
    references: [questions.id],
  }),
  chosenVariant: one(questionsVariants, {
    fields: [chosenVariants.chosenId],
    references: [questionsVariants.id],
  }),
  sessionSubmits: many(sessionSubmits),
}));

export const variants = thesisSchema.table("variants", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  text: text().notNull(),
  explainRight: text().notNull(),
  explainWrong: text().notNull(),
});

export const variantsRelations = relations(variants, ({ many }) => ({
  questionsVariants: many(questionsVariants),
}));

export const questionsVariants = thesisSchema.table("questions_variants", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  questionId: uuid()
    .notNull()
    .references(() => questions.id),
  variantId: uuid()
    .references(() => variants.id),
  isRight: boolean(),
  matchingConfig: json(),
});

export const questionsVariantsRelations = relations(
  questionsVariants,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionsVariants.questionId],
      references: [questions.id],
    }),
    variant: one(variants, {
      fields: [questionsVariants.variantId],
      references: [variants.id],
    }),
  }),
);

export const referencesQuiz = thesisSchema.table("references_quiz", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quizId: uuid()
    .notNull()
    .references(() => quizes.id),
  fileId: uuid()
    .notNull()
    .references(() => files.id),
  userId: uuid()
    .notNull()
    .references(() => users.id),
});

export const referencesQuizRelations = relations(referencesQuiz, ({ one }) => ({
  quiz: one(quizes, {
    fields: [referencesQuiz.quizId],
    references: [quizes.id],
  }),
  file: one(files, {
    fields: [referencesQuiz.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [referencesQuiz.userId],
    references: [users.id],
  }),
}));

export const files = thesisSchema.table("files", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar().notNull(),
  s3Index: varchar().notNull(),
  userId: uuid().references(() => users.id),
});

export const filesRelations = relations(files, ({ one, many }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
  referencesQuiz: many(referencesQuiz),
  referencesQuestion: many(referencesQuestion),
  referencesSubject: many(referencesSubject),
  referencesTheme: many(referencesTheme),
}));

export const referencesQuestion = thesisSchema.table("references_question", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  questionId: uuid()
    .notNull()
    .references(() => questions.id),
  fileId: uuid()
    .notNull()
    .references(() => files.id),
});

export const referencesQuestionRelations = relations(
  referencesQuestion,
  ({ one }) => ({
    question: one(questions, {
      fields: [referencesQuestion.questionId],
      references: [questions.id],
    }),
    file: one(files, {
      fields: [referencesQuestion.fileId],
      references: [files.id],
    }),
  }),
);

export const subjects = thesisSchema.table("subjects", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  name: varchar().notNull(),
  shortName: varchar().notNull(),
  description: text(),
  yearStart: integer().notNull(),
  yearEnd: integer().notNull(),
});

export const subjectsRelations = relations(subjects, ({ many }) => ({
  themes: many(themes),
  referencesSubject: many(referencesSubject),
}));

export const referencesSubject = thesisSchema.table("references_subject", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  subjectId: integer().references(() => subjects.id),
  fileId: uuid().references(() => files.id),
});

export const referencesSubjectRelations = relations(
  referencesSubject,
  ({ one }) => ({
    subject: one(subjects, {
      fields: [referencesSubject.subjectId],
      references: [subjects.id],
    }),
    file: one(files, {
      fields: [referencesSubject.fileId],
      references: [files.id],
    }),
  }),
);

export const themes = thesisSchema.table("themes", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  name: varchar().notNull(),
  description: text(),
  subjectId: integer()
    .notNull()
    .references(() => subjects.id),
});

export const themesRelations = relations(themes, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [themes.subjectId],
    references: [subjects.id],
  }),
  quizzes: many(quizes),
  referencesTheme: many(referencesTheme),
}));

export const referencesTheme = thesisSchema.table("references_theme", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  themeId: integer()
    .notNull()
    .references(() => themes.id),
  fileId: uuid()
    .notNull()
    .references(() => files.id),
});

export const referencesThemeRelations = relations(
  referencesTheme,
  ({ one }) => ({
    theme: one(themes, {
      fields: [referencesTheme.themeId],
      references: [themes.id],
    }),
    file: one(files, {
      fields: [referencesTheme.fileId],
      references: [files.id],
    }),
  }),
);
