import { eq } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../db";
import { cache } from "../../db/redis";
import {
	faqs,
	files,
	quizes,
	referencesTheme,
	summaries,
	themes,
} from "../../db/schema";
import { FileService } from "../file/service";

export class ThemeService {
	private themeCacheTTL = 600;
	private filesCacheTTL = 300;

	private fileService: FileService;

	constructor() {
		this.fileService = new FileService();
	}

	private getSubjectThemesCacheKey(id: number, q?: string): string {
		return q ? `subject:${id}:themes:${q}` : `subject:${id}:themes`;
	}

	private getThemeCacheKey(id: number): string {
		return `theme:${id}`;
	}

	async getThemeById(id: number) {
		const cacheKey = this.getThemeCacheKey(id);

		const cached =
			await cache.get<Awaited<ReturnType<typeof db.query.themes.findFirst>>>(
				cacheKey,
			);
		if (cached) {
			return cached;
		}

		const themeQuery = await db.query.themes.findFirst({
			where: eq(themes.id, id),
		});

		if (!themeQuery) {
			throw status(404, "Not Found");
		}

		await cache.set(cacheKey, themeQuery, this.themeCacheTTL);

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

	async insertNewTheme(subjectId: number, name: string, description?: string) {
		const inserted = await db.insert(themes).values({
			subjectId,
			name,
			description,
		});

		await cache.del(this.getSubjectThemesCacheKey(subjectId));

		return inserted;
	}

	async updateTheme(
		id: number,
		data: { name?: string; description?: string | null },
	) {
		const theme = await db.query.themes.findFirst({
			where: eq(themes.id, id),
		});
		if (!theme) {
			throw status(404, "Not Found");
		}

		const updateData: Record<string, unknown> = {};
		if (data.name !== undefined) updateData.name = data.name;
		if (data.description !== undefined)
			updateData.description = data.description;

		const [updated] = await db
			.update(themes)
			.set(updateData)
			.where(eq(themes.id, id))
			.returning();

		await cache.del(this.getThemeCacheKey(id));
		await cache.del(this.getSubjectThemesCacheKey(theme.subjectId));

		return updated;
	}

	async deleteTheme(id: number) {
		const theme = await db.query.themes.findFirst({
			where: eq(themes.id, id),
		});
		if (!theme) {
			throw status(404, "Not Found");
		}

		await db.transaction(async (tx) => {
			await tx.update(quizes).set({ themeId: null }).where(eq(quizes.themeId, id));
			await tx
				.update(summaries)
				.set({ themeId: null })
				.where(eq(summaries.themeId, id));
			await tx.delete(faqs).where(eq(faqs.themeId, id));
			await tx.delete(referencesTheme).where(eq(referencesTheme.themeId, id));
			await tx.delete(themes).where(eq(themes.id, id));
		});

		await cache.del(this.getThemeCacheKey(id));
		await cache.del(this.getSubjectThemesCacheKey(theme.subjectId));
	}

	async uploadFileToTheme(id: number, file: File, userId: string) {
		const [fileData] = await db.transaction(async (tx) => {
			const fileData = await this.fileService.uploadFile(
				file,
				`themes/${id}/${file.name}`,
				userId,
				tx,
			);
			await tx.insert(referencesTheme).values({
				themeId: id,
				fileId: fileData.id,
			});
			return [fileData];
		});

		return fileData;
	}
}
