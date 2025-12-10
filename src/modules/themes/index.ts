import Elysia, { t } from "elysia";
import { roleMacro } from "../roles/macro";
import { ThemeService } from "./service";
import { QuizService } from "../quiz/service";
import { SummaryService } from "../summary/service";

export const theme = new Elysia({ prefix: "/theme" })
  .use(roleMacro)
  .decorate("themeService", new ThemeService())
  .decorate("quizService", new QuizService())
  .decorate("summaryService", new SummaryService())
  .get(
    "/:id",
    ({ params: { id }, themeService }) => {
      return themeService.getThemeById(id);
    },
    {
      isTeacher: true,
      params: t.Object({
        id: t.Number(),
      }),
    },
  )
  .get(
    "/:id/files",
    ({ params: { id }, themeService }) => {
      return themeService.getThemeFiles(id);
    },
    {
      isTeacher: true,
      params: t.Object({
        id: t.Number(),
      }),
    },
  )
  .post("/:id/files", async ({ params: { id }, themeService, body, userId }) => {
    const file = await body.file;
    return themeService.uploadFileToTheme(id, file, userId);
  },
    {
      isTeacher: true,
      params: t.Object({
        id: t.Number(),
      }),
      body: t.Object({
        file: t.File(),
      }),
    },
  )
  .get(
    "/:id/quizes",
    ({ params: { id }, quizService }) => {
      return quizService.getQuizesByThemeId(id);
    },
    {
      isTeacher: true,
      params: t.Object({
        id: t.Number(),
      }),
    },
  )
  .get("/:id/summaries", ({ params: { id }, summaryService }) => {
    return summaryService.getSummariesByThemeId(id);
  }, {
    isTeacher: true,
    params: t.Object({
      id: t.Number(),
    }),
  });
