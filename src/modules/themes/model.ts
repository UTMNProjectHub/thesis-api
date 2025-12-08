import { createInsertSchema } from "drizzle-typebox";
import Elysia, { t } from "elysia";
import { themes } from "../../db/schema";

const insertSchema = createInsertSchema(themes);
const insertSchemaExcludeSubjectId = t.Omit(insertSchema, ["subjectId"]);

export const ThemeModel = new Elysia().model({
  insertThemesModel: insertSchema,
  insertThemesNoSubject: insertSchemaExcludeSubjectId
});
