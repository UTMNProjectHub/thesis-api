import { status } from "elysia";
import { db } from "../../db";
import {
  files,
  filesRelations,
  referencesSubject,
  subjects,
  themes,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { cache } from "../../db/redis";

export class SubjectService {
  private subjectCacheTTL = 600;
  private themesCacheTTL = 600;
  private filesCacheTTL = 300;

  private getSubjectsCacheKey(): string {
    return "subjects:all";
  }

  private getSubjectCacheKey(id: number): string {
    return `subject:${id}`;
  }

  private getSubjectThemesCacheKey(id: number): string {
    return `subject:${id}:themes`;
  }

  private getSubjectFilesCacheKey(id: number): string {
    return `subject:${id}:files`;
  }

  async getAllSubjects() {
    const cacheKey = this.getSubjectsCacheKey();

    return await cache.getOrSet(
      cacheKey,
      async () => {
        const subjects = await db.query.subjects.findMany();
        return subjects;
      },
      this.subjectCacheTTL,
    );
  }

  async getSubjectById(id: number) {
    const cacheKey = this.getSubjectCacheKey(id);

    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const subjectQuery = await db.query.subjects.findFirst({
      where: eq(subjects.id, id),
    });

    if (!subjectQuery) {
      throw status(404, "Not Found");
    }

    await cache.set(cacheKey, subjectQuery, this.subjectCacheTTL);

    return subjectQuery;
  }

  async getSubjectThemes(id: number) {
    const cacheKey = this.getSubjectThemesCacheKey(id);

    return await cache.getOrSet(
      cacheKey,
      async () => {
        const themeQuery = await db
          .select()
          .from(themes)
          .where(eq(themes.subjectId, id));

        if (!themeQuery) {
          throw status(404, "Not Found");
        }

        return themeQuery;
      },
      this.themesCacheTTL,
    );
  }

  async getSubjectFiles(id: number) {
    const cacheKey = this.getSubjectFilesCacheKey(id);

    return await cache.getOrSet(
      cacheKey,
      async () => {
        const subjectFiles = await db
          .select({
            id: files.id,
            name: files.name,
            s3Index: files.s3Index,
            userId: files.userId,
          })
          .from(files)
          .innerJoin(referencesSubject, eq(files.id, referencesSubject.fileId))
          .where(eq(referencesSubject.subjectId, id));

        return subjectFiles;
      },
      this.filesCacheTTL,
    );
  }

  async invalidateSubjectCache(id: number) {
    await cache.del(this.getSubjectCacheKey(id));
    await cache.del(this.getSubjectThemesCacheKey(id));
    await cache.del(this.getSubjectFilesCacheKey(id));
    await cache.del(this.getSubjectsCacheKey());
  }

  async invalidateAllSubjectsCache() {
    await cache.del(this.getSubjectsCacheKey());
  }
}
