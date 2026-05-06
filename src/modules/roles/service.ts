import { db } from "../../db";

export class RoleService {
	async getAllRoles() {
		return db.query.roles.findMany();
	}
}
