import { eq } from "drizzle-orm";
import { db } from "../../db";
import { roles, users, usersToRoles } from "../../db/schema";
import { status, t } from "elysia";
import { UserModel } from "./model";
import { cache } from "../../db/redis";

export class UserService {
  private userCacheTTL = 300;
  private rolesCacheTTL = 600;

  private getUserCacheKey(userId: string): string {
    return `user:${userId}:profile`;
  }

  private getUserRolesCacheKey(userId: string): string {
    return `user:${userId}:roles`;
  }

  async getUserById(userId: string) {
    const cacheKey = this.getUserCacheKey(userId);
    const cached = await cache.get(cacheKey);

    if (cached) {
      return cached;
    }

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

    const result = {
      id: user.id,
      email: user.email,
      date_created: user.date_created,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      roles: user.usersToRoles.map((utr) => utr.role),
    };

    await cache.set(cacheKey, result, this.userCacheTTL);

    return result;
  }

  async editUserById(userId: string, email?: string, full_name?: string) {
    const updatedUser = await db
      .update(users)
      .set({
        email: email,
        full_name: full_name,
      })
      .where(eq(users.id, userId))
      .returning();

    if (updatedUser.length === 0) {
      throw status(404, "Not Found");
    }

    await cache.del(this.getUserCacheKey(userId));

    return { ...updatedUser[0] };
  }

  async getUserRoles(userId: string) {
    const cacheKey = this.getUserRolesCacheKey(userId);
    const cached = await cache.get(cacheKey);

    if (cached) {
      return cached;
    }

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

    const roles = user.usersToRoles.map((utr) => utr.role);

    await cache.set(cacheKey, roles, this.rolesCacheTTL);

    return roles;
  }

  async invalidateUserCache(userId: string) {
    await cache.del(this.getUserCacheKey(userId));
    await cache.del(this.getUserRolesCacheKey(userId));
  }
}
