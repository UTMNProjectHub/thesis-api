import { Elysia, t } from "elysia";  
import { authMacro } from "../auth/handlers";
import { roleMacro } from "../roles/macro";
import { AdminService } from "./service";
import { AdminModel } from "./model";

export const admin = new Elysia({ prefix: "/admin" })
  .use(authMacro)
  .use(roleMacro)
  .decorate("adminService", new AdminService())
  .model(AdminModel)

  // Stats
  .get("/stats", async ({ adminService }) => {
    return await adminService.getStats();
  }, {
    isAuth: true,
    hasPermission: "view_stats",
    response: { 200: AdminModel.statsResponse },
  })

  // Users
  .get("/users", async ({ adminService }) => {
    return await adminService.getAllUsers();
  }, {
    isAuth: true,
    hasPermission: "manage_users",
    response: { 200: t.Array(AdminModel.userResponse) },
  })

  // Roles
  .get("/roles", async ({ adminService }) => {
    return await adminService.getAllRoles();
  }, {
    isAuth: true,
    hasPermission: "manage_users",
    response: { 200: t.Array(AdminModel.roleResponse) },
  })

  // Update user role
  .put("/users/:userId/role", async ({ params, body, adminService }) => {
    return await adminService.updateUserRole(params.userId, body.roleId);
  }, {
    isAuth: true,
    hasPermission: "manage_users",
    params: t.Object({ userId: t.String() }),
    body: t.Object({ roleId: t.Number() }),
    response: { 200: t.Object({ success: t.Boolean() }) },
  })

  // Delete user
  .delete("/users/:userId", async ({ params, adminService }) => {
    return await adminService.deleteUser(params.userId);
  }, {
    isAuth: true,
    hasPermission: "manage_users",
    params: t.Object({ userId: t.String() }),
    response: { 200: t.Object({ success: t.Boolean() }) },
  })

  // Quizes
  .get("/quizes", async ({ adminService }) => {
    return await adminService.getAllQuizes();
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    response: { 200: t.Array(AdminModel.quizResponse) },
  })

  // Summaries
  .get("/summaries", async ({ adminService }) => {
    return await adminService.getAllSummaries();
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    response: { 200: t.Array(AdminModel.summaryResponse) },
  })

  // Subjects 
  .get("/subjects", async ({ adminService }) => {
    return await adminService.getAllSubjects();
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    response: { 200: t.Array(AdminModel.subjectResponse) },
  })

  .post("/subjects", async ({ body, adminService }) => {
    return await adminService.createSubject(body);
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    body: t.Object({
      name: t.String(),
      shortName: t.String(),
      yearStart: t.Number(),
      yearEnd: t.Number(),
      description: t.Optional(t.String()),
    }),
    response: { 200: AdminModel.subjectResponse },
  })

  .put("/subjects/:id", async ({ params, body, adminService }) => {
    return await adminService.updateSubject(params.id, body);
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    params: t.Object({ id: t.Number() }),
    body: t.Object({
      name: t.String(),
      shortName: t.String(),
      yearStart: t.Number(),
      yearEnd: t.Number(),
      description: t.Optional(t.String()),
    }),
    response: { 200: AdminModel.subjectResponse },
  })

  .delete("/subjects/:id", async ({ params, adminService }) => {
    return await adminService.deleteSubject(params.id);
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    params: t.Object({ id: t.Number() }),
    response: { 200: t.Object({ success: t.Boolean() }) },
  })

  // Themes
  .get("/themes", async ({ adminService }) => {
    return await adminService.getAllThemes();
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    response: { 200: t.Array(AdminModel.themeResponse) },
  })

  .post("/themes", async ({ body, adminService }) => {
    return await adminService.createTheme(body);
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    body: AdminModel.createThemeBody,
    response: { 200: AdminModel.themeResponse },
  })

  .put("/themes/:id", async ({ params, body, adminService }) => {
    return await adminService.updateTheme(params.id, body);
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    params: t.Object({ id: t.Number() }),
    body: AdminModel.updateThemeBody,
    response: { 200: AdminModel.themeResponse },
  })

  .delete("/themes/:id", async ({ params, adminService }) => {
    return await adminService.deleteTheme(params.id);
  }, {
    isAuth: true,
    hasPermission: "manage_content",
    params: t.Object({ id: t.Number() }),
    response: { 200: t.Object({ success: t.Boolean() }) },
  })

  .get("/statistics/details", async ({ adminService }) => {
    return await adminService.getDetailedStats();
  }, {
    isAuth: true,
    hasPermission: "view_stats",
    response: { 200: AdminModel.detailedStatsResponse },
  });