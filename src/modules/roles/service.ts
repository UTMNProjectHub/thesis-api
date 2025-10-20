import { db } from "../../db";

export class RoleService {
  constructor() {}

  async getAllRoles() {
    return db.query.roles.findMany();
  }
}
