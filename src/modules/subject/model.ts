import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { Elysia, t } from "elysia";
import { subjects, themes } from "../../db/schema";

const plainSubject = createSelectSchema(subjects);
const plainTheme = createSelectSchema(themes);
const insertTheme = createInsertSchema(subjects);

export const SubjectModel = new Elysia().model({
	plainSubject: plainSubject,
	multiplePlainSubjects: t.Array(plainSubject),
	plainTheme: plainTheme,
	multiplePlainThemes: t.Array(plainTheme),
	insertSubject: insertTheme,
});
