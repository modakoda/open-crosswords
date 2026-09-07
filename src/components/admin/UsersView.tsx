"use client";

import { UserManager } from "./UserManager";

/**
 * Accounts are not scoped to a content language, so unlike every other view
 * this one takes nothing from the workspace.
 */
export function UsersView() {
  return <UserManager />;
}
