"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Church,
  LogOut,
  Bell,
  Camera,
  Copy,
  Check,
  Calendar,
  DollarSign,
  Heart,
  MessageSquare,
  Shield,
  Sparkles,
  User,
  Users,
  Send,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Smartphone,
  Mail,
  MapPin,
  Maximize2,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  updateMemberPhoto,
  submitMemberInquiry,
  markNotificationRead,
  markAllNotificationsRead,
  logoutMemberPortal,
} from "./actions";
import { uploadImageAction } from "@/lib/cloudinary-actions";

type Member = {
  id: string;
  fullName: string;
  memberIdCode: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  category: string;
  gender: string | null;
  baptized: boolean;
  baptismStatus?: string | null;
  dateOfBirth: string | null;
  weddingAnniversary: string | null;
  occupation: string | null;
  address: string | null;
  joinedAt: string | null;
  departmentName?: string | null;
};

type ChurchData = {
  id: string;
  name: string;
  logoUrl: string | null;
  phone: string | null;
};

type TitheRecord = {
  id: string;
  amount: string;
  week: number;
  month: string; // YYYY-MM
  createdAt: Date;
};

type WelfareRecord = {
  id: string;
  amount: string;
  date: string;
};

type InquiryRecord = {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: string; // pending | in_progress | resolved
  reply: string | null;
  repliedBy: string | null;
  repliedAt: Date | null;
  createdAt: Date;
};

type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: Date;
};

type Props = {
  member: Member;
  church: ChurchData;
  tithes: TitheRecord[];
  welfare: WelfareRecord[];
  inquiries: InquiryRecord[];
  notifications: NotificationRecord[];
};

export function MemberPortalClient({
  member,
  church,
  tithes,
  welfare,
  inquiries,
  notifications,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "tithes" | "welfare" | "inquiries">("profile");
  const [copiedId, setCopiedId] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationRecord | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(false);
  const [pendingPhoto, startPhotoTransition] = useTransition();
  const [pendingInquiry, startInquiryTransition] = useTransition();
  const [pendingLogout, setPendingLogout] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const lastActivityRef = useRef(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inactivity session timeout: 15 minutes with a 2-minute countdown warning
  const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
  const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000;

  const handleStaySignedIn = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowTimeoutWarning(false);
    toast.success("Session active. You remain signed in.");
  }, []);

  const handleGoToMessages = useCallback(() => {
    setActiveTab("inquiries");
    setTimeout(() => {
      const el = document.getElementById("messages-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        const subjectInput = document.getElementById("subject");
        subjectInput?.focus();
      }
    }, 80);
  }, []);

  const handleTimeoutLogout = useCallback(async () => {
    setShowTimeoutWarning(false);
    setPendingLogout(true);
    await logoutMemberPortal();
    toast.error("Your session timed out due to inactivity.");
    router.push("/portal/login?reason=timeout");
    router.refresh();
  }, [router]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const handleUserActivity = () => {
      // Only refresh activity timestamp if warning modal is not currently waiting for action
      if (!showTimeoutWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const timeLeft = INACTIVITY_TIMEOUT_MS - elapsed;

      if (timeLeft <= 0) {
        clearInterval(interval);
        handleTimeoutLogout();
      } else if (timeLeft <= WARNING_BEFORE_TIMEOUT_MS) {
        setShowTimeoutWarning(true);
        setSecondsRemaining(Math.max(1, Math.ceil(timeLeft / 1000)));
      } else {
        if (showTimeoutWarning) {
          setShowTimeoutWarning(false);
        }
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      clearInterval(interval);
    };
  }, [showTimeoutWarning, handleTimeoutLogout]);

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Selected year filter for tithes
  const currentYear = new Date().getFullYear().toString();
  const [titheYear, setTitheYear] = useState(currentYear);

  // Calculate totals
  const totalTithesAllTime = tithes.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const filteredTithes = tithes.filter((t) => t.month.startsWith(titheYear));
  const totalTithesYear = filteredTithes.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalWelfareAllTime = welfare.reduce((acc, w) => acc + Number(w.amount || 0), 0);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function copyMemberId() {
    if (!member.memberIdCode) return;
    navigator.clipboard.writeText(member.memberIdCode);
    setCopiedId(true);
    toast.success("Member ID copied to clipboard!");
    setTimeout(() => setCopiedId(false), 2000);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file is too large. Max 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewPhoto(event.target?.result as string);
      setPhotoModalOpen(true);
    };
    reader.readAsDataURL(file);
  }

  function handleSavePhoto() {
    if (!previewPhoto) return;
    startPhotoTransition(async () => {
      let finalPhotoUrl = previewPhoto;
      if (previewPhoto.startsWith("data:")) {
        toast.loading("Uploading picture to Cloudinary...", { id: "portal-photo-upload" });
        const res = await uploadImageAction(previewPhoto, "churchy/members");
        if (!res.ok || !res.url) {
          toast.error(res.error || "Failed to upload photo to Cloudinary.", { id: "portal-photo-upload" });
          return;
        }
        finalPhotoUrl = res.url;
        toast.success("Picture uploaded to Cloudinary!", { id: "portal-photo-upload" });
      }

      const res = await updateMemberPhoto(finalPhotoUrl);
      if (!res.ok) {
        toast.error(res.error || "Failed to update profile picture.");
        return;
      }
      toast.success("Profile photo updated successfully!");
      setPhotoModalOpen(false);
      setPreviewPhoto(null);
      router.refresh();
    });
  }

  async function handleLogout() {
    setShowLogoutConfirm(false);
    setPendingLogout(true);
    await logoutMemberPortal();
    toast.success("Logged out successfully.");
    router.push("/portal/login");
    router.refresh();
  }

  function handleInquirySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startInquiryTransition(async () => {
      const res = await submitMemberInquiry(formData);
      if (!res.ok) {
        toast.error(res.error || "Failed to submit message.");
        return;
      }
      toast.success("Your message has been sent to the church pastoral team!");
      form.reset();
      router.refresh();
    });
  }

  // Available years from tithes
  const years = Array.from(
    new Set([currentYear, ...tithes.map((t) => t.month.slice(0, 4))])
  ).sort().reverse();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 md:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white shadow-md">
              {church.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={church.logoUrl} alt={church.name} className="h-full w-full object-contain rounded-2xl p-1" />
              ) : (
                <Church className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-tight text-slate-900 leading-tight truncate max-w-[130px] min-[390px]:max-w-[200px] sm:max-w-none">
                {church.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Member Portal
                </span>
              </div>
            </div>
          </div>

          {/* User Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="group relative h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <style>{`
                  @keyframes member-bell-swing {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(18deg); }
                    40% { transform: rotate(-18deg); }
                    60% { transform: rotate(12deg); }
                    80% { transform: rotate(-10deg); }
                  }
                  .member-bell-swing {
                    display: inline-flex;
                    transform-origin: top center;
                    animation: member-bell-swing 1.8s ease-in-out infinite;
                  }
                  .group:hover .member-bell-swing {
                    animation-duration: 0.9s;
                  }
                `}</style>
                <span className="member-bell-swing pointer-events-none">
                  <Bell className="h-4 w-4" />
                </span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-600 text-[10px] font-black text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Panel — full-screen sheet on mobile, popover on sm+ */}
              {notifOpen && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent" onClick={() => { setNotifOpen(false); setSelectedNotification(null); }} />

                  {/* Mobile: full-screen slide-up sheet */}
                  <div className="fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col bg-white rounded-t-3xl shadow-2xl sm:hidden animate-in slide-in-from-bottom duration-250">
                    <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                      <p className="text-sm font-black uppercase tracking-wider text-slate-900">
                        Notifications ({notifications.length})
                      </p>
                      <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await markAllNotificationsRead();
                              toast.success("All notifications marked as read");
                              router.refresh();
                            }}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setNotifOpen(false); setSelectedNotification(null); }}
                          className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <Bell className="h-10 w-10 text-slate-300 mb-3" />
                          <p className="text-sm font-bold text-slate-500">No notifications yet</p>
                          <p className="text-xs text-slate-400 mt-1">You&apos;ll be notified of important church updates here.</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={async () => {
                              if (!n.read) {
                                await markNotificationRead(n.id);
                                router.refresh();
                              }
                              setSelectedNotification(n);
                            }}
                            className={cn(
                              "w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 active:scale-[0.99]",
                              n.read
                                ? "bg-slate-50/50 border-slate-100 text-slate-600"
                                : "bg-blue-50/60 border-blue-200/60 text-slate-900"
                            )}
                          >
                            <div className={cn(
                              "shrink-0 h-9 w-9 rounded-xl flex items-center justify-center mt-0.5",
                              n.read ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-600"
                            )}>
                              <Bell className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1.5">
                                {new Date(n.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Desktop: popover */}
                  <div className="hidden sm:block absolute right-0 top-full mt-2 w-96 rounded-2xl bg-white shadow-2xl border border-slate-100 z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Notifications ({notifications.length})
                      </p>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            await markAllNotificationsRead();
                            toast.success("All notifications marked as read");
                            router.refresh();
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-400 py-6 text-center">No notifications yet.</p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={async () => {
                              if (!n.read) {
                                await markNotificationRead(n.id);
                                router.refresh();
                              }
                              setSelectedNotification(n);
                            }}
                            className={cn(
                              "w-full p-3 rounded-xl border text-left transition-all cursor-pointer hover:shadow-sm",
                              n.read
                                ? "bg-slate-50/50 border-slate-100 text-slate-600"
                                : "bg-blue-50/50 border-blue-100 text-slate-900 font-semibold"
                            )}
                          >
                            <p className="text-xs font-bold">{n.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                            <p className="text-[9px] text-slate-400 mt-1.5">
                              {new Date(n.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Logout Button */}
            <button
              type="button"
              disabled={pendingLogout}
              onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
              title="Sign out of member portal"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden min-[400px]:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {/* Top Hero Banner & Member Identity Card */}
        <div className="rounded-3xl bg-white p-5 sm:p-7 shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 text-center sm:text-left">
            {/* Avatar & Photo Action */}
            <div className="relative group shrink-0">
              {member.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.photoUrl}
                  alt={member.fullName}
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl object-cover ring-4 ring-slate-100 shadow-md transition-transform duration-200 group-hover:scale-102"
                />
              ) : (
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white flex items-center justify-center text-3xl font-black shadow-md ring-4 ring-slate-100">
                  {member.fullName.charAt(0)}
                </div>
              )}

              {/* Upload Overlay Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 h-9 w-9 rounded-2xl bg-blue-700 text-white shadow-lg flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all cursor-pointer"
                title="Upload or change profile picture"
                aria-label="Upload profile picture"
              >
                <Camera className="h-4 w-4" />
              </button>

              {member.photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoZoom(true)}
                  className="absolute top-2 right-2 h-6 w-6 rounded-lg bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  title="Zoom photo"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>

            {/* Member Details */}
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {member.fullName}
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                    <User className="h-3.5 w-3.5 text-slate-400" /> {member.category}
                  </span>
                  {member.departmentName && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">
                        <Users className="h-3.5 w-3.5" /> {member.departmentName}
                      </span>
                    </>
                  )}
                  {member.baptismStatus === "Awaiting Baptism" ? (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Shield className="h-3.5 w-3.5" /> Awaiting Baptism
                      </span>
                    </>
                  ) : member.baptized ? (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <Shield className="h-3.5 w-3.5" /> Baptized
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Unique Member ID & Branch Badge */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <div className="inline-flex items-center gap-2 sm:gap-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 px-3 sm:px-3.5 py-2 max-w-full">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                    Member ID
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-black text-blue-900 tracking-wider truncate">
                    {member.memberIdCode || "UNASSIGNED"}
                  </span>
                  {member.memberIdCode && (
                    <button
                      type="button"
                      onClick={copyMemberId}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                      title="Copy Member ID"
                    >
                      {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-50/80 border border-blue-200/60 px-3 py-2 text-xs font-bold text-blue-900 max-w-full">
                  <Church className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{church.name}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="shrink-0 pt-2 sm:pt-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleGoToMessages}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-5 py-3 sm:py-2.5 text-xs font-black shadow-md shadow-blue-700/20 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Pastoral Care &amp; Inquiries</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Card 1: Tithes */}
          <div
            onClick={() => setActiveTab("tithes")}
            className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm flex items-center gap-4 hover:border-emerald-200 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
            title="Click to view tithes history"
          >
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <DollarSign className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {currentYear} Tithes Given
              </p>
              <p className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                GH₵ {totalTithesYear.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                {filteredTithes.length} record(s) this year
              </p>
            </div>
          </div>

          {/* Card 2: Welfare Dues */}
          <div
            onClick={() => setActiveTab("welfare")}
            className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm flex items-center gap-4 hover:border-blue-200 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
            title="Click to view welfare dues"
          >
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Heart className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Welfare Dues Contributed
              </p>
              <p className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                GH₵ {totalWelfareAllTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                {welfare.length} payment(s) logged
              </p>
            </div>
          </div>

          {/* Card 3: Support Inquiries */}
          <div
            onClick={handleGoToMessages}
            className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm flex items-center gap-4 hover:border-purple-200 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
            title="Click to go to Pastoral Care & Messages"
          >
            <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
              <MessageSquare className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Inquiries &amp; Support
              </p>
              <p className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {inquiries.length} Messages
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                {inquiries.filter((i) => i.status === "resolved").length} resolved
              </p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          <style>{`.portal-tabs::-webkit-scrollbar { display: none; }`}</style>
          {[
            { id: "profile", label: "Profile", mobileLabel: "Profile", icon: User },
            { id: "tithes", label: "Tithes History", mobileLabel: "Tithes", icon: DollarSign },
            { id: "welfare", label: "Welfare Dues", mobileLabel: "Welfare", icon: Heart },
            { id: "inquiries", label: "Messages & Support", mobileLabel: "Messages", icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "shrink-0 min-h-[40px] sm:min-h-[42px] inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                  active
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                    : "bg-white text-slate-600 hover:bg-slate-100/80 border border-slate-200/60"
                )}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="sm:hidden">{tab.mobileLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Profile View */}
        {activeTab === "profile" && (
          <div className="rounded-3xl bg-white p-4 sm:p-6 md:p-8 border border-slate-100 shadow-sm space-y-5 sm:space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Personal &amp; Church Profile</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Your registered details in the church membership database.
              </p>
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Full Name
                </span>
                <p className="text-sm font-bold text-slate-900">{member.fullName}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Unique Member ID
                </span>
                <p className="text-sm font-mono font-bold text-blue-900">{member.memberIdCode || "—"}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Ministry Category
                </span>
                <p className="text-sm font-bold text-slate-900">{member.category}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Phone Number
                </span>
                <p className="text-sm font-bold text-slate-900">{member.phone || "—"}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Email Address
                </span>
                <p className="text-sm font-bold text-slate-900">{member.email || "—"}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Assigned Department
                </span>
                <p className="text-sm font-bold text-slate-900">{member.departmentName || "None"}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Occupation
                </span>
                <p className="text-sm font-bold text-slate-900">{member.occupation || "—"}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Residential Address
                </span>
                <p className="text-sm font-bold text-slate-900">{member.address || "—"}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Joined Date
                </span>
                <p className="text-sm font-bold text-slate-900">{member.joinedAt || "—"}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Camera className="h-5 w-5 text-blue-700 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-blue-950">Update Your Profile Picture</p>
                  <p className="text-[11px] text-blue-800">
                    Your photo will be updated in church records and on your member profile.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto h-9 px-4 rounded-xl bg-blue-700 text-white text-xs font-bold hover:bg-blue-600 transition-colors cursor-pointer shrink-0 text-center"
              >
                Choose Photo
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Tithes History */}
        {activeTab === "tithes" && (
          <div className="rounded-3xl bg-white p-4 sm:p-6 md:p-8 border border-slate-100 shadow-sm space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Tithes Contribution History</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Review your weekly and monthly tithe records recorded by the church finance office.
                </p>
              </div>

              {/* Year Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Year:</span>
                <select
                  value={titheYear}
                  onChange={(e) => setTitheYear(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Total Banner */}
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                  Total for {titheYear}
                </p>
                <p className="text-2xl font-black text-emerald-950 tracking-tight mt-0.5">
                  GH₵ {totalTithesYear.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-emerald-700">All-Time Contributions</p>
                <p className="text-sm font-bold text-emerald-900">
                  GH₵ {totalTithesAllTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Tithes Table & Mobile Cards */}
            {filteredTithes.length === 0 ? (
              <div className="py-12 text-center">
                <DollarSign className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600">No tithes recorded for {titheYear}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Contributions recorded by the church treasury will appear here automatically.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="sm:hidden space-y-2.5">
                  {filteredTithes.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">
                          {new Date(`${t.month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Week {t.week} • {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-emerald-700 text-sm">
                          GH₵ {Number(t.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tablet & Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Month</th>
                        <th className="py-3 px-4">Week</th>
                        <th className="py-3 px-4">Date Logged</th>
                        <th className="py-3 px-4 text-right">Amount (GH₵)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTithes.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {new Date(`${t.month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-600">Week {t.week}</td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                            {Number(t.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Welfare Dues */}
        {activeTab === "welfare" && (
          <div className="rounded-3xl bg-white p-4 sm:p-6 md:p-8 border border-slate-100 shadow-sm space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Welfare Dues Contributions</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Track your welfare assistance and dues contributions.
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-2 text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">
                  Total Dues Paid
                </span>
                <span className="text-lg font-black text-blue-950 font-mono">
                  GH₵ {totalWelfareAllTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {welfare.length === 0 ? (
              <div className="py-12 text-center">
                <Heart className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600">No welfare dues payments recorded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Payments logged by welfare leaders will appear here with official receipts.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="sm:hidden space-y-2.5">
                  {welfare.map((w) => (
                    <div
                      key={w.id}
                      className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">
                          {new Date(w.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Received
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-blue-900 text-sm">
                          GH₵ {Number(w.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tablet & Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Payment Description</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Amount (GH₵)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {welfare.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {new Date(w.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">Monthly Welfare Dues Contribution</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                              <CheckCircle2 className="h-3 w-3" /> Received
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-900 text-sm">
                            {Number(w.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 4: Messages, Inquiries & Complaints */}
        {activeTab === "inquiries" && (
          <div className="space-y-6">
            {/* Submit New Message Card */}
            <div id="messages-section" className="rounded-3xl bg-white p-4 sm:p-6 md:p-8 border border-slate-100 shadow-sm space-y-4 sm:space-y-5 scroll-mt-20 sm:scroll-mt-24">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Send a Message or Pastoral Inquiry
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Have a complaint, prayer request, welfare question, or feedback? Send a direct message to church leadership.
                </p>
              </div>

              <form onSubmit={handleInquirySubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                      Category
                    </label>
                    <select
                      id="category"
                      name="category"
                      defaultValue="General Inquiry"
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm sm:text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Complaint / Grievance">Complaint / Grievance</option>
                      <option value="Pastoral Care &amp; Prayer">Pastoral Care &amp; Prayer</option>
                      <option value="Welfare Assistance">Welfare Assistance</option>
                      <option value="Suggestion &amp; Feedback">Suggestion &amp; Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                      Subject
                    </label>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      placeholder="e.g. Welfare inquiry regarding sickness support"
                      required
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm sm:text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Your Message / Complaint Details
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Please explain in detail so leadership can assist you effectively..."
                    required
                    className="w-full p-3.5 rounded-2xl border border-slate-200 bg-white text-sm sm:text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pendingInquiry}
                  className="w-full sm:w-auto h-11 px-6 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white font-black text-xs tracking-wider uppercase shadow-md shadow-blue-700/20 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {pendingInquiry ? (
                    <>
                      <RotateCcw className="h-4 w-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Send Message to Church Leadership</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Inquiries History */}
            <div className="rounded-3xl bg-white p-4 sm:p-6 md:p-8 border border-slate-100 shadow-sm space-y-4 sm:space-y-5">
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Message History &amp; Leadership Replies ({inquiries.length})
              </h3>

              {inquiries.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">You have not submitted any messages yet.</p>
              ) : (
                <div className="space-y-4">
                  {inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3 text-left"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                              inq.status === "resolved"
                                ? "bg-emerald-100 text-emerald-800"
                                : inq.status === "in_progress"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            )}
                          >
                            {inq.status === "resolved" ? "Resolved" : inq.status === "in_progress" ? "In Progress" : "Pending"}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            {inq.category}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(inq.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{inq.subject}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{inq.message}</p>

                      {/* Leadership Reply Box */}
                      {inq.reply && (
                        <div className="mt-3 p-4 rounded-xl bg-blue-50 border border-blue-200/60 space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-black text-blue-900 uppercase tracking-wider">
                            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                            <span>Response from {inq.repliedBy || "Church Leadership"}:</span>
                          </div>
                          <p className="text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                            {inq.reply}
                          </p>
                          {inq.repliedAt && (
                            <p className="text-[10px] text-blue-600 font-semibold pt-1">
                              Replied on {new Date(inq.repliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Photo Crop / Preview Modal */}
      {photoModalOpen && previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-5 text-center">
            <h3 className="text-base font-black text-slate-900">Confirm Profile Photo</h3>

            <div className="mx-auto h-36 w-36 rounded-full overflow-hidden ring-4 ring-blue-100 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewPhoto} alt="Preview" className="h-full w-full object-cover" />
            </div>

            <p className="text-xs text-slate-500 font-medium">
              This photo will be displayed on your member card, official tithe receipts, and church records.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPhotoModalOpen(false);
                  setPreviewPhoto(null);
                }}
                className="h-11 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pendingPhoto}
                onClick={handleSavePhoto}
                className="h-11 rounded-xl bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-700/25 hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                {pendingPhoto ? "Saving..." : "Save Photo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {photoZoom && member.photoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setPhotoZoom(false)}
        >
          <div className="relative max-w-xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPhotoZoom(false)}
              className="absolute -top-12 right-0 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            >
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={member.photoUrl}
              alt={member.fullName}
              className="max-h-[80vh] w-auto rounded-3xl object-contain shadow-2xl ring-2 ring-white/20"
            />
            <p className="mt-3 text-sm font-bold text-white">{member.fullName}</p>
          </div>
        </div>
      )}
      {/* Sign Out Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shadow-inner">
              <LogOut className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Sign Out of Member Portal?
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Are you sure you want to sign out, {member.fullName.split(" ")[0]}? You will need your Member ID or phone number to sign back in.
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={pendingLogout}
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pendingLogout}
                onClick={handleLogout}
                className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {pendingLogout ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                    <span>Signing Out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Inactivity Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-amber-200 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-inner">
              <Clock className="h-7 w-7 stroke-[2.2] animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider mb-1">
                Inactivity Notice
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Session Expiring Soon
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                You have been inactive for a while. For your privacy and security, your dashboard session will automatically close in:
              </p>
              <div className="mt-3 py-2 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 inline-block">
                <span className="font-mono text-xl font-black text-amber-700 tracking-widest">
                  {formatCountdown(secondsRemaining)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleStaySignedIn}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-blue-700/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Stay Signed In</span>
              </button>
              <button
                type="button"
                onClick={handleTimeoutLogout}
                className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:bg-slate-900/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
          onClick={() => setSelectedNotification(null)}
        >
          {/* Mobile: full-screen from bottom; Desktop: centered card */}
          <div
            className="w-full sm:w-auto sm:max-w-md sm:mx-4 bg-white sm:rounded-3xl rounded-t-3xl max-h-[90vh] sm:max-h-[80vh] flex flex-col shadow-2xl border-t sm:border border-slate-100 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer shrink-0 sm:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                  Notification
                </p>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                  {selectedNotification.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="hidden sm:flex h-8 w-8 rounded-xl bg-slate-100 items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {/* Type & Date */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                  <Bell className="h-3 w-3" />
                  {selectedNotification.type || "General"}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {new Date(selectedNotification.createdAt).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Full Message */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedNotification.message}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="w-full h-11 rounded-xl bg-slate-900 text-white text-xs font-black tracking-wider uppercase hover:bg-slate-800 active:scale-[0.99] transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
