"use client";

import { useActionState } from "react";

type Base = { error?: string; ok?: boolean } | undefined;

/** useActionState that also runs onSuccess (e.g. close a modal) when the action returns { ok: true }. */
export function useFormAction<S extends Base>(action: (prev: S, form: FormData) => Promise<S>, onSuccess?: () => void) {
  return useActionState(async (prev: Awaited<S>, form: FormData) => {
    const result = await action(prev as S, form);
    if (result?.ok) onSuccess?.();
    return result as Awaited<S>;
  }, undefined as Awaited<S>);
}
