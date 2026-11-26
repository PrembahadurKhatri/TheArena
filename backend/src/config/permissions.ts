// Permission catalogue for staff (users with role "admin"). Code-defined so a
// typo in a route's requirePermission(...) fails to compile.
//
// A Super Admin holds every permission. Everyone else gets the permissions of
// their StaffRole, plus per-user grants, minus per-user revokes.
export const PERMISSIONS = {
  "users.read": "View user accounts",
  "users.edit": "Edit user profile details",
  "users.suspend": "Suspend and reactivate accounts",
  "users.blacklist": "Permanently ban (blacklist) accounts",
  "staff.manage": "Create staff, assign roles and permissions",
  "teams.moderate": "Suspend or delete teams",
  "merchants.review": "Approve or reject merchant applications",
  "products.review": "Approve or reject products",
  "grounds.review": "Approve or reject grounds",
  "grounds.manage": "Create and edit any ground",
  "tournaments.review": "Approve or reject tournament activation",
  "fixtures.manage": "Manage tournament fixtures",
  "reports.verify": "Verify match reports",
  "disputes.resolve": "Resolve disputed match results",
  "orders.manage": "View and manage all orders",
  "payments.read": "View payment records",
  "payments.verify": "Verify manual payments",
  "payments.refund": "Mark payments as refunded",
  "subscriptions.manage": "Manage subscriptions",
  "plans.manage": "Create and edit subscription plans",
  "categories.manage": "Manage shop categories and sports",
  "settings.manage": "Change platform settings",
  "announcements.manage": "Publish announcements",
  "moderation.reports": "Handle reported accounts and content",
  "audit.read": "View the audit log",
  "analytics.read": "View platform statistics",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

// Only a Super Admin holds these. They can't be put in a role or granted to a
// user, so staff can never manage staff or change platform settings.
export const RESERVED_PERMISSIONS: readonly Permission[] = ["staff.manage", "settings.manage"];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

// Editable starting points, created once by the RBAC migration (and seed).
export const DEFAULT_STAFF_ROLES: { key: string; name: string; description: string; permissions: Permission[] }[] = [
  {
    key: "hr_manager",
    name: "HR Manager",
    description: "User accounts and reported users. No payments or platform settings.",
    permissions: ["users.read", "users.edit", "users.suspend", "moderation.reports", "audit.read"],
  },
  {
    key: "tournament_manager",
    name: "Tournament Manager",
    description: "Tournament applications, fixtures and match results. No bans or finance.",
    permissions: ["tournaments.review", "fixtures.manage", "reports.verify", "disputes.resolve", "users.read"],
  },
  {
    key: "merchant_manager",
    name: "Merchant Manager",
    description: "Merchant applications, product approval and merchant complaints.",
    permissions: ["merchants.review", "products.review", "orders.manage", "categories.manage", "moderation.reports", "users.read"],
  },
  {
    key: "ground_manager",
    name: "Ground Manager",
    description: "Ground approval, ground complaints and booking information.",
    permissions: ["grounds.review", "grounds.manage", "moderation.reports", "users.read"],
  },
  {
    key: "support_manager",
    name: "Support Manager",
    description: "Front-line support: view accounts and orders, handle reports.",
    permissions: ["users.read", "orders.manage", "moderation.reports"],
  },
  {
    key: "finance_manager",
    name: "Finance Manager",
    description: "Payment records, subscription transactions and revenue reports.",
    permissions: ["payments.read", "payments.verify", "payments.refund", "subscriptions.manage", "analytics.read"],
  },
  {
    key: "content_manager",
    name: "Content Manager",
    description: "Announcements, categories and sports.",
    permissions: ["announcements.manage", "categories.manage"],
  },
];
