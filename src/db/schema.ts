import {
  pgSchema,
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

export const users = authSchema.table("users", {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: varchar().unique(),
  password: varchar(),
  date_created: timestamp(),
});
