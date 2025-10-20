import { Elysia, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { SubjectModel } from "./model";
import { SubjectService } from "./service";
import { roleMacro } from "../roles/macro";

export const subject = new Elysia({ prefix: "/subject" })
  .use(authMacro)
  .use(roleMacro)
  .use(SubjectModel)
  .decorate("subjectService", new SubjectService())
  .get(
    "/all",
    ({ subjectService }) => {
      return subjectService.getAllSubjects();
    },
    {
      isAuth: true,
      response: {
        200: "multiplePlainSubjects",
      },
    },
  )
  .get(
    "/:id",
    ({ params: { id }, subjectService, status }) => {
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
    },
  )
  .get(
    "/:id/themes",
    ({ params: { id }, subjectService }) => {
      return subjectService.getSubjectThemes(id);
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
    },
  )
  .get("/:id/files", ({ subjectService, params: { id } }) => {}, {
    isTeacher: true,
  });
