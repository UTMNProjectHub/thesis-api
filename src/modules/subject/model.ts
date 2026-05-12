import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { Elysia, t } from "elysia";
import { subjects, themes } from "../../db/schema";

const plainSubject = createSelectSchema(subjects);
const plainTheme = createSelectSchema(themes);
const insertTheme = createInsertSchema(subjects);

const updateSubjectBody = t.Object({
	name: t.Optional(t.String()),
	shortName: t.Optional(t.String()),
	yearStart: t.Optional(t.Number()),
	yearEnd: t.Optional(t.Number()),
	description: t.Optional(t.Nullable(t.String())),
});

export const SubjectModel = new Elysia().model({
	plainSubject: plainSubject,
	multiplePlainSubjects: t.Array(plainSubject),
	plainTheme: plainTheme,
	multiplePlainThemes: t.Array(plainTheme),
	insertSubject: insertTheme,
	updateSubjectBody: updateSubjectBody,
});
