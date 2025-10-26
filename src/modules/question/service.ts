import { eq } from "drizzle-orm";
import { db } from "../../db";
import { questions, questionsVariants, variants } from "../../db/schema";

export class QuestionService {
  async getVariantsByQuestionId(id: string) {
    const variantsQuery = await db
      .select({
        id: variants.id,
        text: variants.text,
      })
      .from(variants)
      .fullJoin(questionsVariants, eq(variants.id, questionsVariants.variantId))
      .where(eq(questionsVariants.questionId, id));

    return variantsQuery;
  }
}
