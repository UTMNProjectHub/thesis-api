import Bun from "bun";
import { db } from "../../db";
import { users } from "../../db/schema";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { status } from "elysia";
import { redis } from "../../db/redis";
import postgres from "postgres";

export class AuthService {
  async createUser(email: string, password: string, full_name: string) {
    try {
      const hashed = await Bun.password.hash(password);

      const userRecords = await db
        .insert(users)
        .values({
          email: email,
          password: hashed,
          full_name: full_name,
          date_created: new Date(),
        })
        .returning();

      if (userRecords.length === 0) {
        throw status(500, "Internal Server Error");
      }

      const user = userRecords[0];

      return {
        id: user.id,
        email: user.email,
        date_created: user.date_created,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      };
    } catch (error) {
      if (error instanceof DrizzleQueryError) {
        console.log("asdf");
        if (error.cause instanceof postgres.PostgresError) {
          if (error.cause.constraint_name == "users_email_unique") {
            throw status(409, "User with this email already exists");
          }
        }
      }
      throw error;
    }
  }

  async loginUser(email: string, password: string) {
    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (userRecords.length === 0) {
      throw status(404, "Not Found");
    }

    console.log(userRecords[0]);

    const user = userRecords[0];
    const isPasswordCorrect = await Bun.password.verify(
      password,
      user.password,
    );

    if (!isPasswordCorrect) {
      throw status(401, "Wrong password");
    }

    return {
      id: user.id,
      email: user.email,
      date_created: user.date_created,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
    };
  }
}
