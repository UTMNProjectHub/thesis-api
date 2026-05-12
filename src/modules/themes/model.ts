import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import Elysia, { t } from "elysia";
import { themes } from "../../db/schema";

const insertSchema = createInsertSchema(themes);
const insertSchemaExcludeSubjectId = t.Omit(insertSchema, [
	"subjectId",
]);
const plainTheme = createSelectSchema(themes);

const updateThemeBody = t.Object({
	name: t.Optional(t.String()),
	description: t.Optional(t.Nullable(t.String())),
});

export const ThemeModel = new Elysia().model({
	insertThemesModel: insertSchema,
	insertThemesNoSubject: insertSchemaExcludeSubjectId,
	plainThemeModel: plainTheme,
	updateThemeBody: updateThemeBody,
});
