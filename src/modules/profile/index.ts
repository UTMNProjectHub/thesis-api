import { Elysia, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { UserModel } from "../user/model";
import { UserService } from "../user/service";
import { ProfileModel } from "./model";
import { ProfileService } from "./service";

export const profile = new Elysia({ prefix: "/profile" })
  .use(authMacro)
  .use(UserModel)
  .use(ProfileModel)
  .decorate("userService", new UserService())
  .decorate("profileService", new ProfileService())
  .get(
    "/",
    async ({ userId, userService }) => {
      return await userService.getUserById(userId);
    },
    {
      isAuth: true,
      response: { 200: "minimalUserWithRoles" },
    },
  )
  .put(
    "/",
    async ({ body, userService, userId }) => {
      const profile = await userService.editUserById(
        userId,
        body.email,
        body.full_name,
      );

      return profile;
    },
    {
      isAuth: true,
      body: "editUserRequest",
      response: {
        200: "minimalUser",
      },
    },
  )
  .put(
    "/password",
    async ({ body, profileService, userId }) => {
      await profileService.changeUserPassword(
        userId,
        body.password,
        body.new_password,
      );

      return "ok";
    },
    {
      isAuth: true,
      body: "changePasswordRequest",
      response: {
        200: t.String({
          default: "ok",
        }),
      },
    },
  );
