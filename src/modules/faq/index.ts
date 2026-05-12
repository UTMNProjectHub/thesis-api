import Elysia, { t } from "elysia";
import { FaqService } from "./service";

export const faq = new Elysia({
	prefix: "/faqs",
})
	.decorate("faqService", new FaqService())
	.get(
		"/:id",
		async ({ faqService, params: { id } }) => {
			return faqService.getFaqLink(id);
		},
		{
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ faqService, params: { id } }) => {
			await faqService.deleteFaq(id);
		},
		{
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
		},
	);
