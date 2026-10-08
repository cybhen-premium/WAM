"use server";

import { cookies } from "next/headers";
import { requireUser, getUserBranches } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function switchActiveBranch(branchId: string) {
  const user = await requireUser();
  const branches = await getUserBranches(user.id);
  const match = branches.find((b) => b.church.id === branchId);
  if (!match) {
    return { ok: false, error: "You do not have access to this branch." };
  }

  const cookieStore = await cookies();
  cookieStore.set("active_branch_id", branchId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
    httpOnly: true,
  });

  revalidatePath("/", "layout");
  return { ok: true, branchId, branchName: match.church.name };
}
