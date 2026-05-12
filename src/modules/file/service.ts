import { eq } from "drizzle-orm";
import { db } from "../../db";
import { files } from "../../db/schema";
import { client } from "../../s3";
import { status } from "elysia";
import { CacheService } from "../../db/redis";

export class FileService {
	private cacheService: CacheService;

	constructor() {
		this.cacheService = new CacheService();
	}

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

	// biome-ignore lint/suspicious/noExplicitAny: drizzle transaction type is complex
	async uploadFile(file: File, path: string, userId: string, tx?: any) {
		const fileData = await client.file(path).write(file);

		if (tx) {
			const [fileData] = await tx
				.insert(files)
				.values({
					name: file.name,
					s3Index: path,
					userId: userId,
				})
				.returning();
			return fileData;
		}

		return fileData;
	}

	async deleteFile(id: string) {
		const fileQuery = await db.query.files.findFirst({
			where: eq(files.id, id),
		});

		if (!fileQuery) {
			throw status(404, "Not Found");
		}

		await client.file(fileQuery.s3Index).delete();
		await db.delete(files).where(eq(files.id, id));
	}
}
