import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { status, t } from "elysia";
import { UserModel } from "./model";

export class UserService {
  async getUserById(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        usersToRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw status(404, "Not Found");
    }

    return {
      id: user.id,
      email: user.email,
      date_created: user.date_created,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      roles: user.usersToRoles.map((utr) => utr.role),
    };
  }

  async editUserById(userId: string, email?: string, full_name?: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw status(404, "Not Found");
    }

    const updatedUser = await db
      .update(users)
      .set({
        email: email ?? user.email,
        full_name: full_name ?? user.full_name,
      })
      .where(eq(users.id, userId))
      .returning();

    if (updatedUser.length === 0) {
      throw status(500, "Internal Server Error");
    }

    return { ...updatedUser[0] };
  }
}
