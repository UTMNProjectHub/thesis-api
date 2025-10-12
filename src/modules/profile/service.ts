import { password } from "bun";
import { db } from "../../db";
import { status } from "elysia";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

export class ProfileService {
  async changeUserPassword(
    userId: string,
    old_password: string,
    new_password: string,
  ) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw status(404, "Not Found");
    }

    let isValid = false;

    try {
      isValid = await password.verify(old_password, user.password);
    } catch (err) {
      throw status(401, "Unauthorized");
    }

    if (!isValid) {
      throw status(401, "Unauthorized");
    }

    const hashed_pwd = await password.hash(new_password);

    await db.update(users).set({
      password: hashed_pwd,
    });
  }
}
