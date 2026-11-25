export type AdminRole = "admin" | "super_admin";

export const roleLabel: Record<AdminRole, string> = {
  admin: "Admin",
  super_admin: "Super Admin",
};
