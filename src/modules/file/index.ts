import Elysia, { t } from "elysia";
import { authMacro } from "../auth/handlers";
import { FileService } from "./service";
import { roleMacro } from "../roles/macro";

export const file = new Elysia({
	prefix: "/file",
})
	.use(authMacro)
	.use(roleMacro)
	.decorate("fileService", new FileService())
	.get(
		"/download/:id",
		async ({ params: { id }, fileService }) => {
			return await fileService.downloadFile(id);
		},
		{
			isAuth: true,
		},
	)
	.delete(
		":id",
		async ({ params: { id }, fileService }) => {
			await fileService.deleteFile(id);
		},
		{
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
			isTeacher: true,
		},
	);
