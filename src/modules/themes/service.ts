import { eq } from "drizzle-orm";
import { db } from "../../db";
import { themes } from "../../db/schema";
import { status } from "elysia";

export class ThemeService {
  constructor() {}

  async getThemeById(id: number) {
    const themeQuery = await db.query.themes.findFirst({
      where: eq(themes.id, id),
    });

    if (!themeQuery) {
      throw status(404, "Not Found");
    }

    return themeQuery;
  }

  async getThemeFiles(id: number) {
    const themeQuery = await db.query.files.findMany({
      where: eq(themes.id, id),
    });

    if (!themeQuery) {
      throw status(404, "Not Found");
    }

    return themeQuery;
  }
}
