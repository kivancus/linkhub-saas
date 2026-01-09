-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "username" TEXT,
    "profile_name" TEXT,
    "profile_bio" TEXT,
    "profile_image_url" TEXT,
    "subscription_tier" TEXT NOT NULL DEFAULT 'free',
    "stripe_customer_id" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" TEXT,
    "password_reset_token" TEXT,
    "password_reset_expires" DATETIME,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "bio_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "theme_id" TEXT NOT NULL DEFAULT 'default',
    "custom_colors" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bio_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bio_pages_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bio_page_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "links_bio_page_id_fkey" FOREIGN KEY ("bio_page_id") REFERENCES "bio_pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bio_page_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "link_id" TEXT,
    "visitor_ip_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "referrer" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_events_bio_page_id_fkey" FOREIGN KEY ("bio_page_id") REFERENCES "bio_pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "analytics_events_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "stripe_customer_id" TEXT,
    "plan_id" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL,
    "current_period_start" DATETIME,
    "current_period_end" DATETIME,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "preview_image_url" TEXT,
    "css_template" TEXT NOT NULL,
    "color_variables" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "bio_pages_user_id_key" ON "bio_pages"("user_id");

-- CreateIndex
CREATE INDEX "analytics_events_bio_page_id_event_type_created_at_idx" ON "analytics_events"("bio_page_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_event_type_created_at_idx" ON "analytics_events"("user_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_visitor_ip_hash_bio_page_id_created_at_idx" ON "analytics_events"("visitor_ip_hash", "bio_page_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
