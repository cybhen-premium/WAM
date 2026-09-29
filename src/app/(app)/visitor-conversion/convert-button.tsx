"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { moveToSob } from "./actions";

/**
 * "Convert" = the visitor decides to stay. The category combo box is gone: they become a Regular
 * Attendee and the page jumps straight to the SOB page with their card in view, so the lessons can
 * be worked through. Baptism (lesson 4) is what later makes them a full member.
 */
export function ConvertButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await moveToSob(memberId);
          // SOB filters on ?q= — opening it on their name lands straight on their card.
          router.push(`/sob?q=${encodeURIComponent(memberName)}`);
        })
      }
      title="Move to the School of Baptism"
      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 h-9 text-[11px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      <UserCheck className="h-3.5 w-3.5" /> {pending ? "Moving…" : "Convert"}
    </button>
  );
}
