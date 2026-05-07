import { eq, inArray } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../db";
import { roles, users, usersToRoles, permissions, rolesToPermissions } from "../../db/schema";
import { status, t } from "elysia";
import { UserModel } from "./model";
import { cache } from "../../db/redis";
import { users } from "../../db/schema";

export class UserService {
  private userCacheTTL = 300;
  private rolesCacheTTL = 600;
  private permissionsCacheTTL = 600; //кэш для разрешений

	private getUserCacheKey(userId: string): string {
		return `user:${userId}:profile`;
	}

  private getUserRolesCacheKey(userId: string): string {
    return `user:${userId}:roles`;
  }

  //ключ для кэша разрешений
  private getUserPermissionsCacheKey(userId: string): string {
    return `user:${userId}:permissions`;
  }

	async getUserById(userId: string) {
		const cacheKey = this.getUserCacheKey(userId);
		const cached = await cache.get<{
			id: string;
			email: string;
			date_created: Date;
			full_name: string | null;
			avatar_url: string | null;
			roles: Array<{
				id: number;
				title: string;
				slug: string;
				description: string | null;
				date_created: Date | null;
			}>;
		}>(cacheKey);

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

		return {
			...updatedUser[0],
		};
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

  //получить все разрешения пользователя
  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = this.getUserPermissionsCacheKey(userId);
    const cached = await cache.get<string[]>(cacheKey);

    if (cached) {
      return cached;
    }

    //получаем все роли пользователя
    const userRoles = await this.getUserRoles(userId);
    const roleIds = userRoles.map(role => role.id);

    if (roleIds.length === 0) {
      return [];
    }

    //получаем все разрешения для этих ролей
    const rolesWithPermissions = await db.query.roles.findMany({
      where: inArray(roles.id, roleIds),
      with: {
        rolesToPermissions: { 
          with: {
            permission: true
          }
        }
      }
    });

    //собираем уникальные разрешения
    const permissionsSet = new Set<string>();
    rolesWithPermissions.forEach(role => {
      role.rolesToPermissions.forEach(rp => {
        if (rp.permission?.slug) {
          permissionsSet.add(rp.permission.slug);
        }
      });
    });

    const permissionsList = Array.from(permissionsSet);
    
    //сохраняем в кэш
    await cache.set(cacheKey, permissionsList, this.permissionsCacheTTL);
    
    return permissionsList;
  }

  //проверить конкретное разрешение
  async hasPermission(userId: string, permissionSlug: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permissionSlug);
  }

  //проверить хотя бы одно из разрешений
  async hasAnyPermission(userId: string, permissionSlugs: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissionSlugs.some(p => permissions.includes(p));
  }

  //проверить все разрешения
  async hasAllPermissions(userId: string, permissionSlugs: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissionSlugs.every(p => permissions.includes(p));
  }

  //сбросить кэш разрешений (когда права меняются)
  async invalidatePermissionsCache(userId: string): Promise<void> {
    const cacheKey = this.getUserPermissionsCacheKey(userId);
    await cache.del(cacheKey);
  }

  async invalidateUserCache(userId: string) {
    await cache.del(this.getUserCacheKey(userId));
    await cache.del(this.getUserRolesCacheKey(userId));
    await cache.del(this.getUserPermissionsCacheKey(userId)); 
  }
}