import { eq } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../db";
import { summaries } from "../../db/schema";
import { client as S3Client } from "../../s3";

export class SummaryService {
	async getSummariesByThemeId(themeId: number) {
		const summariesQuery = await db
			.select()
			.from(summaries)
			.where(eq(summaries.themeId, themeId));
		if (!summariesQuery) {
			throw status(404, "Not Found");
		}
		return summariesQuery;
	}

	async getTemporaryDownloadLink(summaryId: number) {
		const summaryQuery = await db.query.summaries.findFirst({
			where: eq(summaries.id, summaryId),
			with: {
				file: true,
			},
		});

		if (!summaryQuery) {
			throw status(404, "Not Found");
		}

		const filePath = summaryQuery.file.s3Index;

		const temporaryLink = await S3Client.presign(filePath, {
			expiresIn: 3600,
		});

		return temporaryLink;
	}

	async deleteSummary(summaryId: number) {
		const summaryQuery = await db.query.summaries.findFirst({
			where: eq(summaries.id, summaryId),
			with: {
				file: true,
			},
		});

		if (!summaryQuery) {
			throw status(404, "Not Found");
		}

		const filePath = summaryQuery.file.s3Index;

		await db.delete(summaries).where(eq(summaries.id, summaryId));
		await S3Client.delete(filePath);
	}
}
