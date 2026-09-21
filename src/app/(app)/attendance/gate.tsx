"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  Database,
  Fingerprint,
  QrCode,
  ScanFace,
  Search,
  TextSearch,
  Undo2,
  Volume2,
} from "lucide-react";
import { useSetUrlParam } from "@/components/use-url-param";
import { cn } from "@/lib/utils";
import { checkIn, undoCheckIn, type CheckInResult } from "./actions";

type Member = { id: string; fullName: string; phone: string | null; category: string };
type Mode = "qr" | "face" | "fingerprint" | "manual";

const MODES: { id: Mode; label: string; icon: typeof QrCode }[] = [
  { id: "qr", label: "QR Code", icon: QrCode },
  { id: "face", label: "Face ID", icon: ScanFace },
  { id: "fingerprint", label: "Fingerprint", icon: Fingerprint },
  { id: "manual", label: "Manual", icon: TextSearch },
];

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = ok ? 880 : 220;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* audio is optional */
  }
}

export function AttendanceGate(props: {
  events: { id: string; label: string }[];
  eventId: string;
  members: Member[];
  checkedIn: string[];
}) {
  const [setParam] = useSetUrlParam();
  const [mode, setMode] = useState<Mode>("qr");
  const [status, setStatus] = useState<{ tone: "ready" | "ok" | "warn" | "error"; text: string }>({
    tone: "ready",
    text: "Gate Ready for Members",
  });
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const checked = useMemo(() => new Set(props.checkedIn), [props.checkedIn]);
  const active = props.events.find((e) => e.id === props.eventId);

  function report(r: CheckInResult) {
    beep(r.ok);
    if (!r.ok) setStatus({ tone: "error", text: r.error });
    else if (r.already) setStatus({ tone: "warn", text: `${r.name} is already checked in` });
    else setStatus({ tone: "ok", text: `Welcome, ${r.name}!` });
  }

  function doCheckIn(ref: string) {
    if (!props.eventId) return report({ ok: false, error: "Select an event first." });
    startTransition(async () => report(await checkIn(props.eventId, ref)));
  }

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? props.members.filter((m) => m.fullName.toLowerCase().includes(term) || m.phone?.includes(term))
      : props.members;
    return list.slice(0, 50);
  }, [q, props.members]);

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black italic text-slate-900 tracking-tight">Attendance Gate</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Active: {active ? active.label : "None selected"} · {checked.size} checked in
          </p>
        </div>
        <label className="flex w-full sm:w-auto items-center gap-2 rounded-2xl bg-amber-500 px-4 h-14 shadow-lg shadow-amber-200">
          <CalendarDays className="h-5 w-5 text-slate-900 shrink-0" />
          <select
            value={props.eventId}
            onChange={(e) => setParam("event", e.target.value)}
            className="bg-transparent text-sm font-black text-slate-900 outline-none sm:w-64"
            aria-label="Event"
          >
            <option value="">{props.events.length ? "Select Event..." : "No recent events. Create one first."}</option>
            {props.events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1.5">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl h-10 text-[10px] sm:text-xs font-black uppercase transition-all",
              mode === id ? "bg-[#1e3a8a] text-white shadow" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="space-y-4">
          <div className="rounded-[2rem] bg-white p-3 shadow-xl shadow-slate-200">
            {mode === "qr" && <QrScanner onScan={doCheckIn} paused={pending} />}
            {mode === "face" && <Unavailable icon={ScanFace} text="Face ID check-in needs a camera-based recognition service. Coming soon." />}
            {mode === "fingerprint" && <Unavailable icon={Fingerprint} text="Fingerprint check-in needs a compatible USB scanner. Coming soon." />}
            {mode === "manual" && <Unavailable icon={TextSearch} text="Search the directory on the right and tap a member to check them in." />}
          </div>
          <div
            className={cn(
              "rounded-2xl p-4 text-center text-white shadow-lg transition-colors",
              status.tone === "ready" && "bg-[#1e3a8a]",
              status.tone === "ok" && "bg-emerald-600",
              status.tone === "warn" && "bg-amber-500",
              status.tone === "error" && "bg-red-600",
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Scanning Status</p>
            <p className="font-black">{status.text}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Manual Search..."
              className="w-full h-14 rounded-2xl bg-white pl-11 pr-4 text-sm font-semibold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            />
          </div>
          <div className="rounded-[2rem] bg-white shadow-sm min-h-[380px] overflow-hidden">
            {props.members.length === 0 ? (
              <div className="flex h-[380px] flex-col items-center justify-center text-slate-300">
                <Database className="h-10 w-10 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Directory Access</p>
                <p className="text-xs text-slate-400 mt-1">Add members to start checking people in.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
                {results.map((m) => {
                  const isIn = checked.has(m.id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{m.fullName}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {m.category}
                          {m.phone ? ` · ${m.phone}` : ""}
                        </p>
                      </div>
                      {isIn ? (
                        <button
                          disabled={pending}
                          onClick={() => startTransition(() => undoCheckIn(props.eventId, m.id))}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 h-9 text-[10px] font-black uppercase text-emerald-700 hover:bg-emerald-100"
                          title="Undo check-in"
                        >
                          <Check className="h-4 w-4" /> In <Undo2 className="h-3 w-3 opacity-60" />
                        </button>
                      ) : (
                        <button
                          disabled={pending || !props.eventId}
                          onClick={() => doCheckIn(m.id)}
                          className="rounded-xl bg-[#1e3a8a] px-4 h-9 text-[10px] font-black uppercase text-white hover:bg-blue-900 disabled:opacity-40"
                        >
                          Check In
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Unavailable({ icon: Icon, text }: { icon: typeof QrCode; text: string }) {
  return (
    <div className="flex aspect-square flex-col items-center justify-center rounded-[1.6rem] bg-slate-900 p-8 text-center text-slate-300">
      <Icon className="h-12 w-12 mb-4 text-slate-500" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

// Minimal typing for the browser's built-in BarcodeDetector (Chrome, Edge, Android).
type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

function QrScanner({ onScan, paused }: { onScan: (value: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef({ value: "", at: 0 });
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  useEffect(() => {
    onScanRef.current = onScan;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    (async () => {
      if (!window.BarcodeDetector) {
        setError("This browser can't scan QR codes. Use Chrome or Edge, or switch to Manual.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setError("Camera access was blocked. Allow the camera or switch to Manual.");
        return;
      }
      if (cancelled || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      timer = setInterval(async () => {
        if (!videoRef.current || pausedRef.current) return;
        const [code] = await detector.detect(videoRef.current).catch(() => []);
        if (!code) return;
        const now = Date.now();
        // Ignore the same code for 4 seconds so one person isn't checked in repeatedly.
        if (code.rawValue === last.current.value && now - last.current.at < 4000) return;
        last.current = { value: code.rawValue, at: now };
        onScanRef.current(code.rawValue);
      }, 400);
    })();

    return () => {
      cancelled = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative aspect-square overflow-hidden rounded-[1.6rem] bg-black">
      {error ? (
        <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-300">{error}</div>
      ) : (
        <>
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-[15%] rounded-lg border-2 border-dashed border-red-500/50">
            {["top-0 left-0 border-t-4 border-l-4", "top-0 right-0 border-t-4 border-r-4", "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"].map((c) => (
              <span key={c} className={`absolute h-6 w-6 border-red-500 ${c}`} />
            ))}
          </div>
          <span className="absolute left-3 top-3 h-3 w-3 rounded-full bg-green-600 animate-pulse" />
          <span className="absolute bottom-3 right-4 flex items-center gap-1 text-[10px] font-black uppercase text-white">
            Audio Active <Volume2 className="h-3 w-3" />
          </span>
        </>
      )}
    </div>
  );
}
