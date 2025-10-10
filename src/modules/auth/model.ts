import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { Elysia, t } from "elysia";
import { users } from "../../db/schema";

const _createUser = createInsertSchema(users, {
  email: t.String({
    format: "email",
    error: "Неверый формат почты",
  }),
  password: t.String({
    pattern: "^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$",
    error:
      "Пароль должен быть не менее 8 символов в длину, включать только латинские символы, не менее одной заглавной буквы и цифры, а так же специального знака.",
  }),
});

const loginRequest = t.Object({
  email: t.String({
    format: "email",
    error: "Неверный формат почты",
  }),
  password: t.String(),
});

const _selectUser = createSelectSchema(users);

export const AuthModel = new Elysia().model({
  registerBody: t.Omit(_createUser, ["id", "date_created"]),
  loginBody: loginRequest,
  registerResponse: t.Intersect([
    t.Omit(_selectUser, ["password"]),
    t.Object({ refresh_token: t.String({}) }),
  ]),
});
