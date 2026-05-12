import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../db";
import { cache } from "../../db/redis";
import {
	faqs,
	files,
	quizes,
	referencesSubject,
	referencesTheme,
	subjects,
	summaries,
	themes,
} from "../../db/schema";
import { FileService } from "../file/service";

export class SubjectService {
	private subjectCacheTTL = 600;
	private themesCacheTTL = 600;
	private filesCacheTTL = 300;

	private fileService: FileService;

	constructor() {
		this.fileService = new FileService();
	}

	protected getSubjectsCacheKey(q?: string): string {
		return q ? `subjects:all:${q}` : "subjects:all";
	}

	protected getSubjectCacheKey(id: number): string {
		return `subject:${id}`;
	}

	protected getSubjectThemesCacheKey(id: number, q?: string): string {
		return q ? `subject:${id}:themes:${q}` : `subject:${id}:themes`;
	}

	async getAllSubjects(q?: string) {
		const cacheKey = this.getSubjectsCacheKey(q);

		return await cache.getOrSet(
			cacheKey,
			async () => {
				const result = await db.query.subjects.findMany({
					where: q
						? (table, { ilike: ilikeOp }) =>
								or(
									ilikeOp(table.name, `%${q}%`),
									ilikeOp(table.shortName, `%${q}%`),
								)
						: undefined,
				});
				return result;
			},
			this.subjectCacheTTL,
		);
	}

	async getSubjectById(id: number) {
		const cacheKey = this.getSubjectCacheKey(id);

		const cached =
			await cache.get<Awaited<ReturnType<typeof db.query.subjects.findFirst>>>(
				cacheKey,
			);
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

	async createNewSubject(
		name: string,
		shortName: string,
		yearStart: number,
		yearEnd: number,
		description?: string,
	) {
		const inserted = await db.insert(subjects).values({
			name,
			shortName,
			description,
			yearStart,
			yearEnd,
		});

		await this.invalidateAllSubjectsCache();

		return inserted;
	}

	async getSubjectThemes(id: number, q?: string) {
		const cacheKey = this.getSubjectThemesCacheKey(id, q);

		return await cache.getOrSet(
			cacheKey,
			async () => {
				const themeQuery = await db
					.select()
					.from(themes)
					.where(
						q
							? and(eq(themes.subjectId, id), ilike(themes.name, `%${q}%`))
							: eq(themes.subjectId, id),
					);

				if (!themeQuery) {
					throw status(404, "Not Found");
				}

				return themeQuery;
			},
			this.themesCacheTTL,
		);
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

	async uploadFileToSubject(id: number, file: File, userId: string) {
		const [fileData] = await db.transaction(async (tx) => {
			const fileData = await this.fileService.uploadFile(
				file,
				`subjects/${id}/${file.name}`,
				userId,
				tx,
			);
			await tx.insert(referencesSubject).values({
				subjectId: id,
				fileId: fileData.id,
			});
			return [fileData];
		});

		return fileData;
	}

	async updateSubject(
		id: number,
		data: {
			name?: string;
			shortName?: string;
			yearStart?: number;
			yearEnd?: number;
			description?: string | null;
		},
	) {
		const subject = await db.query.subjects.findFirst({
			where: eq(subjects.id, id),
		});
		if (!subject) {
			throw status(404, "Not Found");
		}

		const updateData: Record<string, unknown> = {};
		if (data.name !== undefined) updateData.name = data.name;
		if (data.shortName !== undefined) updateData.shortName = data.shortName;
		if (data.yearStart !== undefined) updateData.yearStart = data.yearStart;
		if (data.yearEnd !== undefined) updateData.yearEnd = data.yearEnd;
		if (data.description !== undefined)
			updateData.description = data.description;

		const [updated] = await db
			.update(subjects)
			.set(updateData)
			.where(eq(subjects.id, id))
			.returning();

		await this.invalidateSubjectCache(id);

		return updated;
	}

	async deleteSubject(id: number) {
		const subject = await db.query.subjects.findFirst({
			where: eq(subjects.id, id),
		});
		if (!subject) {
			throw status(404, "Not Found");
		}

		await db.transaction(async (tx) => {
			const themeRows = await tx
				.select({ id: themes.id })
				.from(themes)
				.where(eq(themes.subjectId, id));

			if (themeRows.length > 0) {
				const themeIds = themeRows.map((t) => t.id);
				await tx
					.update(quizes)
					.set({ themeId: null })
					.where(inArray(quizes.themeId, themeIds));
				await tx
					.update(summaries)
					.set({ themeId: null })
					.where(inArray(summaries.themeId, themeIds));
				await tx.delete(faqs).where(inArray(faqs.themeId, themeIds));
				await tx
					.delete(referencesTheme)
					.where(inArray(referencesTheme.themeId, themeIds));
				await tx.delete(themes).where(eq(themes.subjectId, id));
			}

			await tx
				.delete(referencesSubject)
				.where(eq(referencesSubject.subjectId, id));
			await tx.delete(subjects).where(eq(subjects.id, id));
		});

		await this.invalidateSubjectCache(id);
		await this.invalidateAllSubjectsCache();
	}

	async invalidateSubjectCache(id: number) {
		await cache.del(this.getSubjectCacheKey(id));
		await cache.del(this.getSubjectThemesCacheKey(id));
		await cache.del(this.getSubjectsCacheKey());
	}

	async invalidateAllSubjectsCache() {
		await cache.del(this.getSubjectsCacheKey());
	}
}
