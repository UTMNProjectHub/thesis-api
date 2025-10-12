import { relations } from "drizzle-orm";
import {
  pgSchema,
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const thesisSchema = pgSchema("thesis");

export const users = thesisSchema.table("users", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: varchar().unique().notNull(),
  full_name: varchar(),
  avatar_url: varchar(),
  password: varchar().notNull(),
  date_created: timestamp().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  usersToRoles: many(usersToRoles),
}));

export const usersToRoles = thesisSchema.table("users_roles", {
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  roleId: integer()
    .notNull()
    .references(() => roles.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const usersToRolesRelations = relations(usersToRoles, ({ one }) => ({
  user: one(users, {
    fields: [usersToRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [usersToRoles.roleId],
    references: [roles.id],
  }),
}));

export const roles = thesisSchema.table("roles", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  title: varchar(),
  slug: varchar().unique(),
  description: varchar(),
  date_created: timestamp(),
});

export const rolesRelations = relations(roles, ({ many }) => ({
  rolesToPermissions: many(rolesToPermissions),
  usersToRoles: many(usersToRoles),
}));

export const rolesToPermissions = thesisSchema.table("roles_permissions", {
  roleId: integer()
    .notNull()
    .references(() => roles.id, { onUpdate: "cascade", onDelete: "cascade" }),
  permissionId: integer()
    .notNull()
    .references(() => permissions.id, {
      onUpdate: "cascade",
      onDelete: "cascade",
    }),
});

export const rolesToPermissionsRelations = relations(
  rolesToPermissions,
  ({ one }) => ({
    role: one(roles, {
      fields: [rolesToPermissions.roleId],
      references: [roles.id],
    }),
    permission: one(permissions, {
      fields: [rolesToPermissions.permissionId],
      references: [permissions.id],
    }),
  }),
);

export const permissions = thesisSchema.table("permission", {
  id: integer().generatedByDefaultAsIdentity().primaryKey(),
  title: varchar(),
  slug: varchar().unique(),
  description: varchar(),
  date_created: timestamp(),
});

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolesToPermissions: many(rolesToPermissions),
}));
