import { eq } from "drizzle-orm";
import { db } from "../../db";
import { summaries } from "../../db/schema";
import { status } from "elysia";

export class SummaryService {
  constructor() {}

  async getSummariesByThemeId(themeId: number) {
    const summariesQuery = await db.select().from(summaries).where(eq(summaries.themeId, themeId));
    if (!summariesQuery) {
      throw status(404, "Not Found");
    }
    return summariesQuery;
  }
}