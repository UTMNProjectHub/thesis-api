import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { subjects, themes } from "../../db/schema";
import { Elysia, t } from "elysia";

const plainSubject = createSelectSchema(subjects);
const plainTheme = createSelectSchema(themes);
const insertTheme = createInsertSchema(subjects);

export const SubjectModel = new Elysia().model({
  plainSubject: plainSubject,
  multiplePlainSubjects: t.Array(plainSubject),
  plainTheme: plainTheme,
  multiplePlainThemes: t.Array(plainTheme),
  insertSubject: insertTheme
});
