import Bun from "bun";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import Redis from "ioredis";

export class AuthService {
  private redisClient: Redis;

  constructor() {
    this.redisClient = new Redis(process.env.REDIS_URL as string);
  }

  close() {
    this.redisClient.disconnect();
  }

  async storeRefreshToken(userId: string, userAgent: string, jwt: string) {
    await this.redisClient.hset(
      `user:${userId}:refresh`,
      `agent:${userAgent}`,
      jwt,
    );
  }

  async checkRefreshToken(userId: string, userAgent: string, jwt: string) {
    const storedToken = await this.redisClient.hget(
      `user:${userId}:refresh`,
      `agent:${userAgent}`,
    );
    if (storedToken !== jwt) {
      throw status(401, "Unauthorized");
    }

    return true;
  }

  async createUser(email: string, password: string) {
    const hashed = await Bun.password.hash(password);

    const userRecords = await db
      .insert(users)
      .values({
        email: email,
        password: hashed,
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
    };
  }
}
