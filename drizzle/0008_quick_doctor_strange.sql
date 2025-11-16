ALTER TABLE "thesis"."session_submits" DROP CONSTRAINT "session_submits_submitId_chosen_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."session_submits" ADD CONSTRAINT "session_submits_submitId_chosen_variants_id_fk" FOREIGN KEY ("submitId") REFERENCES "thesis"."chosen_variants"("id") ON DELETE cascade ON UPDATE cascade;