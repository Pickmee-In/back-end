CREATE TYPE "public"."clothing_category" AS ENUM('jacket', 'shirt', 'sweater', 'dress', 'pants', 'skirt', 'shoes', 'accessories', 'other');--> statement-breakpoint
CREATE TYPE "public"."clothing_condition" AS ENUM('like_new', 'excellent', 'good', 'fair');--> statement-breakpoint
CREATE TYPE "public"."drop_point_type" AS ENUM('thrift_store', 'donation_center', 'charity_dropbox', 'recycle_center');--> statement-breakpoint
CREATE TYPE "public"."impact_event_type" AS ENUM('swap_completed', 'donation_completed', 'thrift_completed', 'recycle_completed');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'active', 'reserved', 'matched', 'completed', 'archived', 'removed');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('swap', 'donate', 'thrift');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'chatting', 'arranged', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'system', 'offer', 'shipping', 'meetup');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('match', 'chat', 'item', 'impact', 'system');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('owner', 'picker', 'admin');--> statement-breakpoint
CREATE TYPE "public"."sentimental_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('swap', 'donate', 'thrift', 'recycle');--> statement-breakpoint
CREATE TYPE "public"."swipe_action" AS ENUM('pick', 'skip');--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"required_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badges_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "clothing_ai_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"detected_category" "clothing_category",
	"detected_color" varchar(50),
	"detected_fabric" varchar(100),
	"estimated_condition" "clothing_condition",
	"confidence" numeric(5, 2),
	"recommendation" text,
	"raw_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clothing_item_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clothing_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"category" "clothing_category" NOT NULL,
	"size" varchar(20) NOT NULL,
	"condition" "clothing_condition" NOT NULL,
	"brand" varchar(100),
	"color" varchar(50),
	"material" varchar(100),
	"listing_type" "listing_type" NOT NULL,
	"is_free" boolean DEFAULT true NOT NULL,
	"price" numeric(12, 2),
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"location_label" varchar(255),
	"ai_recommendation" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "participant_role" NOT NULL,
	"last_read_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drop_point_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drop_point_id" uuid NOT NULL,
	"service_type" "service_type" NOT NULL,
	"description" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drop_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "drop_point_type" NOT NULL,
	"address" text NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"phone" varchar(30),
	"website" text,
	"open_hours" jsonb,
	"accepted_categories" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid,
	"match_id" uuid,
	"event_type" "impact_event_type" NOT NULL,
	"textile_waste_kg" numeric(8, 2) DEFAULT '0',
	"water_saved_liters" integer DEFAULT 0,
	"co2_saved_kg" numeric(8, 2) DEFAULT '0',
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"picker_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"meetup_location" varchar(255),
	"shipping_method" varchar(100),
	"note" text,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"arranged_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(150) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(500) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "saved_drop_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"drop_point_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"action" "swipe_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_impact_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"items_reused" integer DEFAULT 0 NOT NULL,
	"textile_waste_kg" numeric(10, 2) DEFAULT '0',
	"water_saved_liters" integer DEFAULT 0 NOT NULL,
	"co2_saved_kg" numeric(10, 2) DEFAULT '0',
	"eco_points" integer DEFAULT 0 NOT NULL,
	"level" varchar(50) DEFAULT 'Eco Beginner' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"name" varchar(255) NOT NULL,
	"username" varchar(50),
	"phone" varchar(20),
	"avatar" text,
	"bio" text,
	"google_id" varchar(255),
	"apple_id" varchar(255),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"location_label" varchar(255),
	"preferences" jsonb,
	"is_profile_complete" boolean DEFAULT false NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_apple_id_unique" UNIQUE("apple_id")
);
--> statement-breakpoint
CREATE TABLE "wardrobe_love_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"wear_frequency_per_month" integer,
	"last_worn_at" timestamp with time zone,
	"sentimental_level" "sentimental_level",
	"score" integer NOT NULL,
	"recommendation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clothing_ai_analyses" ADD CONSTRAINT "clothing_ai_analyses_item_id_clothing_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."clothing_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clothing_item_photos" ADD CONSTRAINT "clothing_item_photos_item_id_clothing_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."clothing_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clothing_items" ADD CONSTRAINT "clothing_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_point_services" ADD CONSTRAINT "drop_point_services_drop_point_id_drop_points_id_fk" FOREIGN KEY ("drop_point_id") REFERENCES "public"."drop_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_events" ADD CONSTRAINT "impact_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_events" ADD CONSTRAINT "impact_events_item_id_clothing_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."clothing_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_events" ADD CONSTRAINT "impact_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_item_id_clothing_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."clothing_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_picker_id_users_id_fk" FOREIGN KEY ("picker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_drop_points" ADD CONSTRAINT "saved_drop_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_drop_points" ADD CONSTRAINT "saved_drop_points_drop_point_id_drop_points_id_fk" FOREIGN KEY ("drop_point_id") REFERENCES "public"."drop_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_item_id_clothing_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."clothing_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_impact_stats" ADD CONSTRAINT "user_impact_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wardrobe_love_scores" ADD CONSTRAINT "wardrobe_love_scores_item_id_clothing_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."clothing_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wardrobe_love_scores" ADD CONSTRAINT "wardrobe_love_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_badges_required_points" ON "badges" USING btree ("required_points");--> statement-breakpoint
CREATE INDEX "idx_clothing_ai_analyses_item_id" ON "clothing_ai_analyses" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_clothing_ai_analyses_created_at" ON "clothing_ai_analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_clothing_item_photos_item_id" ON "clothing_item_photos" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_clothing_item_photos_item_order" ON "clothing_item_photos" USING btree ("item_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_clothing_items_owner_id" ON "clothing_items" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_clothing_items_category" ON "clothing_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_clothing_items_listing_type" ON "clothing_items" USING btree ("listing_type");--> statement-breakpoint
CREATE INDEX "idx_clothing_items_status" ON "clothing_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_clothing_items_location" ON "clothing_items" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "idx_clothing_items_created_at" ON "clothing_items" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conversation_participants" ON "conversation_participants" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_participants_user_id" ON "conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conversations_match_id" ON "conversations" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_drop_point_services" ON "drop_point_services" USING btree ("drop_point_id","service_type");--> statement-breakpoint
CREATE INDEX "idx_drop_point_services_type" ON "drop_point_services" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "idx_drop_points_type" ON "drop_points" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_drop_points_active" ON "drop_points" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_drop_points_location" ON "drop_points" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "idx_impact_events_user_id" ON "impact_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_impact_events_event_type" ON "impact_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_impact_events_created_at" ON "impact_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_matches_item_picker" ON "matches" USING btree ("item_id","picker_id");--> statement-breakpoint
CREATE INDEX "idx_matches_owner_id" ON "matches" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_matches_picker_id" ON "matches" USING btree ("picker_id");--> statement-breakpoint
CREATE INDEX "idx_matches_status" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender_id" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_type" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_notifications_is_read" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_token" ON "refresh_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_saved_drop_points" ON "saved_drop_points" USING btree ("user_id","drop_point_id");--> statement-breakpoint
CREATE INDEX "idx_saved_drop_points_drop_point_id" ON "saved_drop_points" USING btree ("drop_point_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_swipes_user_item" ON "swipes" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_swipes_item_id" ON "swipes" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_swipes_action" ON "swipes" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_badges" ON "user_badges" USING btree ("user_id","badge_id");--> statement-breakpoint
CREATE INDEX "idx_user_badges_badge_id" ON "user_badges" USING btree ("badge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_impact_stats_user_id" ON "user_impact_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_google_id" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "idx_users_apple_id" ON "users" USING btree ("apple_id");--> statement-breakpoint
CREATE INDEX "idx_users_location" ON "users" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "idx_wardrobe_love_scores_item_id" ON "wardrobe_love_scores" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_wardrobe_love_scores_user_id" ON "wardrobe_love_scores" USING btree ("user_id");