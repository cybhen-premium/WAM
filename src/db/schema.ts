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
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  passwordChangeRequired: boolean("password_change_required").notNull().default(false),
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

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: timestamp("locked_until"),
});

/* -------------------------------------------------------------- tenant ---- */

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
  customFooter: text("custom_footer"),
  autoWelcomeSms: boolean("auto_welcome_sms").notNull().default(false),
  // Member care automation (daily birthday / anniversary SMS)
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  birthdayTemplate: text("birthday_template")
    .notNull()
    .default("Happy birthday [Name]! The whole church family celebrates you today. God bless you."),
  anniversaryTemplate: text("anniversary_template")
    .notNull()
    .default("Happy wedding anniversary [Name]! May God continue to bless your home."),
  // Automated warm message sent to members absent on Sunday
  absenceTemplate: text("absence_template")
    .notNull()
    .default("Hello [Name], we missed you at church today! We prayed for you and look forward to seeing you next Sunday. Have a blessed week!"),
  // Pastoral AI preferences
  absenceThresholdWeeks: integer("absence_threshold_weeks").notNull().default(3),
  aiLanguage: text("ai_language").notNull().default("English"),
  aiTone: text("ai_tone").notNull().default("Warm & Pastoral"),
  // Messaging credits
  smsCredits: integer("sms_credits").notNull().default(20),
  // Welfare dues expected monthly target per member
  welfareMonthlyTarget: numeric("welfare_monthly_target", { precision: 12, scale: 2 })
    .notNull()
    .default("20.00"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  // 2FA method required for the church owner (super admin). none | email | totp
  ownerTwoFactorMethod: text("owner_two_factor_method").notNull().default("none"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffStatusEnum = pgEnum("staff_status", ["active", "pending", "suspended"]);

// Links a login (user) to a church. The church owner gets an "admin" row on setup.
export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => department.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("admin"),
    twoFactorMethod: text("two_factor_method").notNull().default("none"), // none | email | sms
    status: staffStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("staff_church_idx").on(t.churchId), index("staff_user_idx").on(t.userId)],
);

/**
 * What a staff member may access, one row per module. A superadmin (staff.role = "admin") implicitly
 * has every module, so this table only holds the assignments made for everyone else.
 */
export const staffModule = pgTable(
  "staff_module",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    // A key from MODULES in src/lib/permissions.ts (text, so modules can be added without a migration).
    module: text("module").notNull(),
  },
  (t) => [
    uniqueIndex("staff_module_uq").on(t.staffId, t.module),
    index("staff_module_church_idx").on(t.churchId),
  ],
);

/* ------------------------------------------------------------- members ---- */

export const genderEnum = pgEnum("gender", ["male", "female"]);

export const department = pgTable("department", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => church.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const member = pgTable(
  "member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => department.id, { onDelete: "set null" }),
    fullName: text("full_name").notNull(),
    photoUrl: text("photo_url"),
    phone: text("phone"),
    email: text("email"),
    gender: genderEnum("gender"),
    // General Member, Choir, Deacon, ... (see MEMBER_CATEGORIES)
    category: text("category").notNull().default("General Member"),
    baptized: boolean("baptized").notNull().default(false),
    baptismStatus: text("baptism_status").notNull().default("Not Baptized"),
    dateOfBirth: date("date_of_birth"),
    weddingAnniversary: date("wedding_anniversary"),
    maritalStatus: text("marital_status"),
    occupation: text("occupation"),
    skills: text("skills"),
    address: text("address"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    invitedBy: text("invited_by"),
    joinedAt: date("joined_at").defaultNow(),
    // Set when a "Visitor" is converted to another category.
    convertedAt: date("converted_at"),
    // Permanent marker: the person was received through Akwaaba. Baptism later changes `category`
    // (Visitor / Regular Attendee → General Member), but this flag never changes, so they stay on the
    // Akwaaba list after they graduate.
    fromAkwaaba: boolean("from_akwaaba").notNull().default(false),
    // Reception intake status in Akwaaba: "visiting" (guests/visitors) or "staying" (regular attendees).
    // Preserved even when SOB graduation converts their category to "General Member".
    akwaabaStatus: text("akwaaba_status"),
    lastAttendedAt: date("last_attended_at"),
    active: boolean("active").notNull().default(true),
    // Member Portal credentials & unique identification
    memberIdCode: text("member_id_code").unique(),
    passwordHash: text("password_hash"),
    portalActive: boolean("portal_active").notNull().default(false),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("member_church_idx").on(t.churchId)],
);

// Tracks the SOB lessons each member completes before baptism.
export const sobProgress = pgTable(
  "sob_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    // Lesson number completed
    lesson: integer("lesson").notNull(),
    completedAt: date("completed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("sob_church_idx").on(t.churchId),
    uniqueIndex("sob_member_lesson_uq").on(t.memberId, t.lesson),
  ],
);

// Customizable SOB curriculum lessons per church.
export const sobLesson = pgTable(
  "sob_lesson",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    lessonNumber: integer("lesson_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    isGraduation: boolean("is_graduation").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("sob_lesson_church_idx").on(t.churchId),
    uniqueIndex("sob_lesson_church_num_uq").on(t.churchId, t.lessonNumber),
  ],
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

export const welfareDues = pgTable(
  "welfare_dues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    date: timestamp("date", { mode: "string" }).notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("welfare_dues_church_idx").on(t.churchId, t.date)],
);

export const tithe = pgTable(
  "tithe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    week: integer("week").notNull(), // 1, 2, 3, 4, 5
    month: text("month").notNull(), // YYYY-MM
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("tithe_church_idx").on(t.churchId, t.month),
    // Ensure one entry per member per week per month
    uniqueIndex("tithe_member_week_idx").on(t.memberId, t.week, t.month),
  ]
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
    departmentId: uuid("department_id").references(() => department.id, { onDelete: "set null" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => event.id, { onDelete: "set null" }),
    serviceDate: date("service_date").notNull(),
    status: text("status").notNull().default("present"), // present | absent
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("attendance_church_idx").on(t.churchId, t.serviceDate),
    uniqueIndex("attendance_member_date_uq").on(t.memberId, t.serviceDate),
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



/* ------------------------------------------------------------ platform ---- */

// App-wide configuration edited by platform admins (e.g. the SMS gateway). Secrets inside `value` are encrypted.
export const platformSetting = pgTable("platform_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* --------------------------------------------------------- activity log ---- */

/**
 * Audit trail: one row per meaningful action any staff member or church owner performs.
 * `module`   — which section of the app (matches ModuleKey or "auth")
 * `action`   — short human-readable verb phrase, e.g. "Added member", "Deleted transaction"
 * `metadata` — optional JSON with extra context (ids, names, amounts, …)
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull().default("Unknown"),
    actorEmail: text("actor_email"),
    module: text("module").notNull(),
    actionCode: text("action_code"),
    action: text("action").notNull(),
    ipAddress: text("ip_address"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("activity_log_church_idx").on(t.churchId), index("activity_log_created_idx").on(t.createdAt)],
);

/* --------------------------------------------------------- notifications ---- */

/**
 * System and administrative notifications.
 * `type`      - "staff_login" | "security" | "system"
 * `title`     - Short header summary
 * `message`   - Descriptive text
 * `read`      - Boolean read state
 * `metadata`  - Actor details, IP, client info, etc.
 */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("staff_login"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notification_church_idx").on(t.churchId),
    index("notification_user_idx").on(t.userId),
    index("notification_created_idx").on(t.createdAt),
    index("notification_read_idx").on(t.read),
  ],
);

/* ---------------------------------------------------- member portal ------ */

export const memberOtp = pgTable(
  "member_otp",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    purpose: text("purpose").notNull().default("activation"), // "activation" | "reset"
    expiresAt: timestamp("expires_at").notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("member_otp_member_idx").on(t.memberId)],
);

export const memberSession = pgTable(
  "member_session",
  {
    id: text("id").primaryKey(), // secure random session token
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("member_session_member_idx").on(t.memberId)],
);

export const memberInquiry = pgTable(
  "member_inquiry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    category: text("category").notNull().default("General Inquiry"),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"), // "pending" | "in_progress" | "resolved"
    reply: text("reply"),
    repliedBy: text("replied_by"),
    repliedAt: timestamp("replied_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("member_inquiry_church_idx").on(t.churchId),
    index("member_inquiry_member_idx").on(t.memberId),
    index("member_inquiry_status_idx").on(t.status),
  ],
);

export const memberNotification = pgTable(
  "member_notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("general"), // "tithe" | "welfare" | "inquiry_reply" | "announcement" | "general"
    read: boolean("read").notNull().default(false),
    link: text("link"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("member_notif_member_idx").on(t.memberId),
    index("member_notif_created_idx").on(t.createdAt),
    index("member_notif_read_idx").on(t.read),
  ],
);

/* -------------------------------------------------------------- shepherds ---- */

export const shepherd = pgTable(
  "shepherd",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    shepherdCode: text("shepherd_code"),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("shepherd_church_idx").on(t.churchId),
    index("shepherd_phone_idx").on(t.phone),
  ],
);

export const shepherdSession = pgTable(
  "shepherd_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shepherdId: uuid("shepherd_id")
      .notNull()
      .references(() => shepherd.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("shepherd_session_shepherd_idx").on(t.shepherdId)],
);

export const shepherdDisciple = pgTable(
  "shepherd_disciple",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    shepherdId: uuid("shepherd_id")
      .notNull()
      .references(() => shepherd.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("member"), // "member" | "sob"
    assignedAt: date("assigned_at").defaultNow(),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("shepherd_disciple_shepherd_idx").on(t.shepherdId),
    index("shepherd_disciple_member_idx").on(t.memberId),
    uniqueIndex("shepherd_disciple_church_member_idx").on(t.churchId, t.memberId),
  ],
);

export const shepherdAttendance = pgTable(
  "shepherd_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    shepherdId: uuid("shepherd_id")
      .notNull()
      .references(() => shepherd.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    serviceDate: date("service_date").notNull(),
    serviceType: text("service_type").notNull(), // "Wednesday (KJMC)" | "Friday (Rescue Hour)" | "Sunday Service" | "Custom"
    customProgramName: text("custom_program_name"),
    status: text("status").notNull().default("Present"), // "Present" | "Absent" | "Late" | "Excused"
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("shepherd_att_shepherd_idx").on(t.shepherdId),
    index("shepherd_att_member_idx").on(t.memberId),
    index("shepherd_att_date_idx").on(t.serviceDate),
  ],
);

export const shepherdSpiritualLog = pgTable(
  "shepherd_spiritual_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => church.id, { onDelete: "cascade" }),
    shepherdId: uuid("shepherd_id")
      .notNull()
      .references(() => shepherd.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    quietTimeConsistency: text("quiet_time_consistency").notNull().default("Daily"), // "Daily" | "4-6 Days" | "1-3 Days" | "Inconsistent" | "None"
    quietTimeScripture: text("quiet_time_scripture"),
    prayerLifeRating: text("prayer_life_rating").notNull().default("Consistent"), // "Vibrant" | "Consistent" | "Needs Growth" | "Struggling"
    prayerFocusNotes: text("prayer_focus_notes"),
    spiritualStatus: text("spiritual_status").notNull().default("Steady"), // "Thriving" | "Steady" | "Needs Attention" | "Critical"
    shepherdRemarks: text("shepherd_remarks"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("shepherd_spirit_shepherd_idx").on(t.shepherdId),
    index("shepherd_spirit_member_idx").on(t.memberId),
    index("shepherd_spirit_date_idx").on(t.logDate),
  ],
);



