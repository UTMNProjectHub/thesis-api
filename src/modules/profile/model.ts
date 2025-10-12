import { Elysia, t } from "elysia";
import { strongPassword } from "../auth/model";

export const ProfileModel = new Elysia().model({
  changePasswordRequest: t.Object({
    password: t.String(),
    new_password: strongPassword,
  }),
});
