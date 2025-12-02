import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import Elysia, { t } from "elysia";
import { roles, users } from "../../db/schema";

const _selectUser = createSelectSchema(users);
const _selectRole = createSelectSchema(roles);
const _insertUser = createInsertSchema(users);

export const UserModel = new Elysia().model({
  minimalUser: t.Omit(_selectUser, t.Union([t.Literal("password")])),
  minimalUserWithRoles: t.Object({
    id: t.String({ format: "uuid" }),
    email: t.String(),
    full_name: t.Nullable(t.String()),
    avatar_url: t.Nullable(t.String()),
    date_created: t.Union([t.Date(), t.String()]),
    roles: t.Array(_selectRole),
  }),
  editUserRequest: t.Object({
    email: t.String({ format: "email" }),
    full_name: t.String({ minLength: 3 }),
  }),
});
