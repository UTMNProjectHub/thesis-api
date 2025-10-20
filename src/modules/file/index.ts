import Elysia from "elysia";
import { authMacro } from "../auth/handlers";
import { FileService } from "./service";

export const file = new Elysia({ prefix: "/file" })
  .use(authMacro)
  .decorate("fileService", new FileService())
  .get(
    "/download/:id",
    async ({ params: { id }, fileService }) => {
      return await fileService.downloadFile(id);
    },
    { isAuth: true },
  );
