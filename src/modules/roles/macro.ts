import Elysia, { status } from "elysia";
import { authMacro } from "../auth/handlers";
import { UserService } from "../user/service";

export const roleMacro = new Elysia()
  .use(authMacro)
  .decorate("userService", new UserService())
  .macro("isTeacher", {
    isAuth: true,
    async resolve({ userId, userService }) {
      const roles = await userService.getUserRoles(userId);

      if (!roles.find((role) => role.slug === "teacher")) {
        throw status(403, "Forbidden");
      }

      return { userId, roles };
    },
  });
