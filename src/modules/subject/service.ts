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

export class SubjectService {
  constructor() {}

  async getAllSubjects() {
    const subjects = await db.query.subjects.findMany();
    return subjects;
  }

  async getSubjectById(id: number) {
    const subjectQuery = await db.query.subjects.findFirst({
      where: eq(subjects.id, id),
    });

    if (!subjectQuery) {
      throw status(404, "Not Found");
    }

    return subjectQuery;
  }

  async getSubjectThemes(id: number) {
    const themeQuery = await db
      .select()
      .from(themes)
      .where(eq(themes.subjectId, id));

    if (!themeQuery) {
      throw status(404, "Not Found");
    }

    console.log(themeQuery);

    return themeQuery;
  }

  async getSubjectFiles(id: number) {
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
  }
}
