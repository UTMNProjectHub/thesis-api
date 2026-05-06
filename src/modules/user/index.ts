import { Elysia, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { UserModel } from "./model";
import { UserService } from "./service";

export const user = new Elysia({})
	.use(authMacro)
	.decorate("userService", new UserService())
	.use(UserModel)
	.get(
		"/user/:id",
		({ userService, params: { id } }) => {
			const user = userService.getUserById(id);

			return user;
		},
		{
			params: t.Object({
				id: t.String({
					format: "uuid",
					error: "Неверный формат",
				}),
			}),
			isAuth: true,
		},
	);
