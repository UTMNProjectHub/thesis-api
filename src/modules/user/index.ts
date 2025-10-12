import { Elysia, status, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { UserService } from "./service";
import { UserModel } from "./model";

export const user = new Elysia({})
  .use(authMacro)
  .decorate("userService", new UserService())
  .use(UserModel)
  .get(
    "/user/:id",
    ({ userService, params: { id }, status }) => {
      const user = userService.getUserById(id);

      return user;
    },
    {
      params: t.Object({
        id: t.String({
          format: "uuid",
          error: "Неверный формат",
        }),
      }),
      isAuth: true,
    },
  );
