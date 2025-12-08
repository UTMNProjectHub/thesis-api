import { Elysia, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { SubjectModel } from "./model";
import { SubjectService } from "./service";
import { roleMacro } from "../roles/macro";
import { ThemeService } from "../themes/service";
import { ThemeModel } from "../themes/model";

export const subject = new Elysia({ prefix: "/subject" })
  .use(authMacro)
  .use(roleMacro)
  .use(SubjectModel)
  .use(ThemeModel)
  .decorate("subjectService", new SubjectService())
  .decorate("themeService", new ThemeService())
  .get(
    "/all",
    ({ subjectService, query }) => {
      return subjectService.getAllSubjects(query.q);
    },
    {
      isAuth: true,
      query: t.Object({
        q: t.Optional(t.String()),
      }),
      response: {
        200: "multiplePlainSubjects",
      },
    }
  )
  .post(
    "/",
    ({ subjectService, body }) => {
      return subjectService.createNewSubject(
        body.name,
        body.shortName,
        body.yearStart,
        body.yearEnd,
        body.description ?? undefined
      );
    },
    {
      isTeacher: true,
      body: "insertSubject",
    }
  )
  .get(
    "/:id",
    ({ params: { id }, subjectService }) => {
      return subjectService.getSubjectById(id);
    },
    {
      isAuth: true,
      params: t.Object({
        id: t.Number(),
      }),
      response: {
        200: "plainSubject",
        404: t.String(),
      },
    }
  )
  .get(
    "/:id/themes",
    ({ params: { id }, subjectService, query }) => {
      return subjectService.getSubjectThemes(id, query.q);
    },
    {
      isTeacher: true,
      response: {
        200: "multiplePlainThemes",
        404: t.String(),
      },
      params: t.Object({
        id: t.Number(),
      }),
      query: t.Object({
        q: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/:id/themes",
    ({ params: { id }, themeService, subjectService, body }) => {
      subjectService.getSubjectById(id);

      return themeService.insertNewTheme(
        id,
        body.name,
        body.description ?? undefined
      );
    },
    {
      isTeacher: true,
      params: t.Object({
        id: t.Number(),
      }),
      body: "insertThemesNoSubject",
    }
  )
  .get(
    "/:id/files",
    ({ subjectService, params: { id } }) => {
      return subjectService.getSubjectFiles(id);
    },
    {
      isTeacher: true,
      params: t.Object({
        id: t.Number(),
      }),
    }
  )
  .post(
    "/:id/files",
    async ({ params: { id }, subjectService, body, userId }) => {
      const file = await body.file;
      return subjectService.uploadFileToSubject(id, file, userId);
    },
    {
      isTeacher: true,
      params: t.Object({
        id: t.Number(),
      }),
      body: t.Object({
        file: t.File(),
      }),
    }
  );
