import Elysia, { t } from "elysia";
import { SummaryService } from "./service";

export const summary = new Elysia({
	prefix: "/summaries",
})
	.decorate("SummaryService", new SummaryService())
	.get(
		":id",
		async ({ SummaryService, params: { id } }) => {
			const link = await SummaryService.getTemporaryDownloadLink(id);

			return link;
		},
		{
			params: t.Object({
				id: t.Number(),
			}),
		},
	)
	.delete(
		":id",
		async ({ SummaryService, params: { id } }) => {
			await SummaryService.deleteSummary(id);
		},
		{
			params: t.Object({
				id: t.Number(),
			}),
		},
	);
