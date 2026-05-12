import { eq } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../db";
import { faqs, files } from "../../db/schema";
import { client as S3Client } from "../../s3";
import { FileService } from "../file/service";

export class FaqService {
	private fileService: FileService;

	constructor() {
		this.fileService = new FileService();
	}

	async getFaqsByThemeId(themeId: number) {
		return db.select().from(faqs).where(eq(faqs.themeId, themeId));
	}

	async getFaqLink(faqId: string) {
		const faq = await db.query.faqs.findFirst({
			where: eq(faqs.id, faqId),
			with: { file: true },
		});

		if (!faq) throw status(404, "Not Found");

		return S3Client.presign(faq.file.s3Index, { expiresIn: 3600 });
	}

	async deleteFaq(faqId: string) {
		const faq = await db.query.faqs.findFirst({
			where: eq(faqs.id, faqId),
			with: { file: true },
		});

		if (!faq) throw status(404, "Not Found");

		await db.delete(faqs).where(eq(faqs.id, faqId));
		await this.fileService.deleteFile(faq.file.id);
	}
}
