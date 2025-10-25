import Bun from "bun";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import { redis } from "../../db/redis";

export class AuthService {
  async createUser(email: string, password: string, full_name: string) {
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
  }

  async loginUser(email: string, password: string) {
    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (userRecords.length === 0) {
      throw status(404, "Not Found");
    }

    const user = userRecords[0];
    const isPasswordCorrect = await Bun.password.verify(
      password,
      user.password!,
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
