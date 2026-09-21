import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------- auth ---- */
// Tables required by Better Auth (user, session, account, verification).

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* -------------------------------------------------------------- tenant ---- */

export const planEnum = pgEnum("plan", ["seed", "growth", "abundance", "harvest", "enterprise"]);

export const church = pgTable("church", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  pastorName: text("pastor_name"),
  phone: text("phone"),
  location: text("location"),
  denominationCode: text("denomination_code"),
  email: text("email"),
  ghanaPostGps: text("ghana_post_gps"),
  directions: text("directions"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  // Branding & receipts
  logoUrl: text("logo_url"),
  brandPrimary: text("brand_primary").notNull().default("#1e3a8a"),
  brandSecondary: text("brand_secondary").notNull().default("#f59e0b"),
  receiptTemplate: text("receipt_template").notNull().default("classic"),
  receiptFont: text("receipt_font").notNull().default("Arial"),
  receiptWatermark: boolean("receipt_watermark").notNull().default(false),
  // Messaging
  senderId: text("sender_id"),
  senderIdRequested: text("sender_id_requested"),
  senderIdStatus: text("sender_id_status").notNull().default("none"), // none | pending | approved | rejected
  appendFooter: boolean("append_footer").notNull().default(true),
  autoWelcomeSms: boolean("auto_welcome_sms").notNull().default(false),
  // Welfare automation (daily birthday / anniversary SMS)
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  birthdayTemplate: text("birthday_template")
    .notNull()
    .default("Happy birthday [Name]! The whole church family celebrates you today. God bless you."),
  anniversaryTemplate: text("anniversary_template")
    .notNull()
    .default("Happy wedding anniversary [Name]! May God continue to bless your home."),
  // Pastoral AI preferences
  absenceThresholdWeeks: integer("absence_threshold_weeks").notNull().default(3),
  aiLanguage: text("ai_language").notNull().default("English"),
  aiTone: text("ai_tone").notNull().default("Warm & Pastoral"),
  // Billing
  plan: planEnum("plan").notNull().default("harvest"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  renewsAt: date("renews_at"),
  smsCredits: integer("sms_credits").notNull().default(20),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffRoleEnum = pgEnum("staff_role", ["admin", "pastor", "finance", "secretary", "usher"]);
export const staffStatusEnum = pgEnum("staff_status", ["active", "pending"]);

// Links a login (user) to a church. The church owner gets an "admin" row on setup.
export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: staffRoleEnum("role").notNull().default("admin"),
    status: staffStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("staff_church_idx").on(t.churchId), index("staff_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------- members ---- */

export const genderEnum = pgEnum("gender", ["male", "female"]);

export const member = pgTable(
  "member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    gender: genderEnum("gender"),
    // General Member, Choir, Deacon, ... (see MEMBER_CATEGORIES)
    category: text("category").notNull().default("General Member"),
    baptized: boolean("baptized").notNull().default(false),
    dateOfBirth: date("date_of_birth"),
    weddingAnniversary: date("wedding_anniversary"),
    maritalStatus: text("marital_status"),
    occupation: text("occupation"),
    skills: text("skills"),
    address: text("address"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    joinedAt: date("joined_at").defaultNow(),
    // Set when a "Visitor" is converted to another category.
    convertedAt: date("converted_at"),
    lastAttendedAt: date("last_attended_at"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("member_church_idx").on(t.churchId)],
);

/* ------------------------------------------------------------ finances ---- */

export const txnTypeEnum = pgEnum("txn_type", ["income", "expense"]);

export const vendor = pgTable("vendor", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => church.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  service: text("service"),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectFund = pgTable("project_fund", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => church.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  target: numeric("target", { precision: 12, scale: 2 }).notNull(),
  dueOn: date("due_on"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transaction = pgTable(
  "transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    type: txnTypeEnum("type").notNull(),
    // See INCOME_CATEGORIES / EXPENSE_CATEGORIES; "Tithe" and "Welfare Dues" come from their own tabs.
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    // Payer for income (tithe, dues), beneficiary for welfare disbursements.
    memberId: uuid("member_id").references(() => member.id, { onDelete: "set null" }),
    vendorId: uuid("vendor_id").references(() => vendor.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projectFund.id, { onDelete: "set null" }),
    // Sequential per church, assigned to income so receipts can be printed.
    receiptNo: integer("receipt_no"),
    description: text("description"),
    occurredOn: date("occurred_on").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("txn_church_idx").on(t.churchId, t.occurredOn)],
);

/* --------------------------------------------------- events & attendance -- */

export const event = pgTable(
  "event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Service, Rehearsal, Meeting, Outreach, Celebration, Other
    type: text("type").notNull().default("Service"),
    description: text("description"),
    location: text("location"),
    // Wall-clock local time (string mode avoids server-timezone shifts).
    startsAt: timestamp("starts_at", { mode: "string" }).notNull(),
    endsAt: timestamp("ends_at", { mode: "string" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("event_church_idx").on(t.churchId, t.startsAt)],
);

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => event.id, { onDelete: "set null" }),
    serviceDate: date("service_date").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("attendance_church_idx").on(t.churchId, t.serviceDate),
    uniqueIndex("attendance_event_member_uq").on(t.eventId, t.memberId),
  ],
);

/* ---------------------------------------------------- pastoral care ------ */

export const followUpStageEnum = pgEnum("follow_up_stage", ["new", "contacted", "visited", "integrated"]);

export const followUp = pgTable("follow_up", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => church.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  // "convert" (new converts / visitors pipeline) or "lost_sheep" (pastoral visit for an absent member)
  kind: text("kind").notNull().default("convert"),
  stage: followUpStageEnum("stage").notNull().default("new"),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------ communication ---- */

export const messageLog = pgTable("message_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => church.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("sms"),
  // broadcast | birthday | anniversary | welcome | reach_out
  kind: text("kind").notNull().default("broadcast"),
  topic: text("topic"),
  audience: text("audience"),
  // sent | failed | queued (no provider configured)
  status: text("status").notNull().default("sent"),
  recipients: integer("recipients").notNull(),
  body: text("body").notNull(),
  creditsUsed: integer("credits_used").notNull().default(0),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const sermon = pgTable("sermon", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => church.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("sermon"), // plan | sermon | series
  topic: text("topic"),
  scripture: text("scripture"),
  content: text("content").notNull(),
  preachOn: date("preach_on"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------- billing ---- */

export const payment = pgTable("payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => church.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // plan | topup
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  credits: integer("credits").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | paid | failed
  reference: text("reference").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------ platform ---- */

// App-wide configuration edited by platform admins (e.g. the SMS gateway). Secrets inside `value` are encrypted.
export const platformSetting = pgTable("platform_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
