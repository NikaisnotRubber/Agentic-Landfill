export type RoleUserPair = { role: string; user: string };

export function expandRoleUsersFromCell(usersCell: string, role: string): RoleUserPair[] {
  const roleName = role.trim();
  if (!roleName) {
    return [];
  }

  const users = usersCell
    .split(",")
    .map((user) => user.trim())
    .filter(Boolean);

  return users.map((user) => ({ role: roleName, user }));
}
