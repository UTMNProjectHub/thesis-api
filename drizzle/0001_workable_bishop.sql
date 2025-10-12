CREATE TABLE "thesis"."roles_permissions" (
	"roleId" integer NOT NULL,
	"permissionId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thesis"."users_roles" (
	"userId" uuid NOT NULL,
	"roleId" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thesis"."roles_permissions" ADD CONSTRAINT "roles_permissions_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "thesis"."roles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."roles_permissions" ADD CONSTRAINT "roles_permissions_permissionId_permission_id_fk" FOREIGN KEY ("permissionId") REFERENCES "thesis"."permission"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."users_roles" ADD CONSTRAINT "users_roles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "thesis"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."users_roles" ADD CONSTRAINT "users_roles_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "thesis"."roles"("id") ON DELETE cascade ON UPDATE cascade;