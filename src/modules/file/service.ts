import { eq } from "drizzle-orm";
import { db } from "../../db";
import { files } from "../../db/schema";
import { client } from "../../s3";

export class FileService {
  constructor() {}

  async downloadFile(id: string) {
    const fileQuery = await db
      .select({
        name: files.name,
        index: files.s3Index,
      })
      .from(files)
      .where(eq(files.id, id));

    const fileData = fileQuery[0];
    const stream = client.file(fileData.index).stream();

    console.log(client.file(fileData.index).exists());

    return new Response(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileData.name}"`,
      },
    });
  }
}
