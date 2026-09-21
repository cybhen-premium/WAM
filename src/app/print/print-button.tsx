"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 h-10 text-xs font-black uppercase tracking-widest text-white"
    >
      <Printer className="h-4 w-4" /> Print / Save PDF
    </button>
  );
}
