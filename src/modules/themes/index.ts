import Elysia, { t } from "elysia";
import { roleMacro } from "../roles/macro";
import { ThemeService } from "./service";

export const theme = new Elysia({ prefix: "/theme" })
  .use(roleMacro)
  .decorate("themeService", new ThemeService())
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
  );
