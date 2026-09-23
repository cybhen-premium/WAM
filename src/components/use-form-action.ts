"use client";

import { useActionState } from "react";
import { toast } from "sonner";

type Base = { error?: string; ok?: boolean } | undefined;

/** useActionState that also runs onSuccess (e.g. close a modal) when the action returns { ok: true }. */
export function useFormAction<S extends Base>(action: (prev: S, form: FormData) => Promise<S>, onSuccess?: () => void) {
  return useActionState(async (prev: Awaited<S>, form: FormData) => {
    const result = await action(prev as S, form);
    if (result?.ok) {
      toast.success("Saved successfully!");
      onSuccess?.();
    } else if (result?.error) {
      toast.error(result.error);
    }
    return result as Awaited<S>;
  }, undefined as Awaited<S>);
}
