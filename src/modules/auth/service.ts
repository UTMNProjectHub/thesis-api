import Bun from "bun";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import { redis } from "../../db/redis";

export class AuthService {
  async storeRefreshToken(userId: string, userAgent: string, jwt: string) {
    try {
      await redis.hset(`user:${userId}:refresh`, `agent:${userAgent}`, jwt);
      await redis.expire(`user:${userId}:refresh`, 60 * 60 * 24 * 14);
    } catch (error) {
      console.error("Error storing refresh token:", error);
      throw status(500, "Failed to store refresh token");
    }
  }

  async checkRefreshToken(userId: string, userAgent: string, jwt: string) {
    try {
      const storedToken = await redis.hget(
        `user:${userId}:refresh`,
        `agent:${userAgent}`,
      );
      if (storedToken !== jwt) {
        throw status(401, "Unauthorized");
      }

      return true;
    } catch (error) {
      if (error instanceof Error && (error as any).status === 401) {
        throw error;
      }
      console.error("Error checking refresh token:", error);
      throw status(500, "Failed to verify refresh token");
    }
  }

  async revokeRefreshToken(userId: string, userAgent: string) {
    try {
      await redis.hdel(`user:${userId}:refresh`, `agent:${userAgent}`);
    } catch (error) {
      console.error("Error revoking refresh token:", error);
    }
  }

  async revokeAllRefreshTokens(userId: string) {
    try {
      await redis.del(`user:${userId}:refresh`);
    } catch (error) {
      console.error("Error revoking all refresh tokens:", error);
    }
  }

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
