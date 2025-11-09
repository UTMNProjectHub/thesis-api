import { eq } from "drizzle-orm";
import { db } from "../../db";
import { files, referencesTheme, themes } from "../../db/schema";
import { status } from "elysia";
import { client } from "../../s3";
import { FileService } from "../file/service";

export class ThemeService {

  private fileService: FileService;

  constructor() {
    this.fileService = new FileService();
  }

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
    const themeFiles = await db
      .select({
        id: files.id,
        name: files.name,
        s3Index: files.s3Index,
        userId: files.userId,
      })
      .from(files)
      .innerJoin(referencesTheme, eq(files.id, referencesTheme.fileId))
      .where(eq(referencesTheme.themeId, id));

    return themeFiles;
  }

  async uploadFileToTheme(id: number, file: File, userId: string) {
    const [fileData] = await db.transaction(async (tx) => {
      const fileData = await this
        .fileService.uploadFile(file, `themes/${id}/${file.name}`, userId, tx);
      await tx.insert(referencesTheme).values({
        themeId: id,
        fileId: fileData.id,
      });
      return [fileData];
    });
    
    return fileData;
  }
}
