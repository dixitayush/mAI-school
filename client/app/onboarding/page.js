"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  ImageIcon,
  IndianRupee,
  Link2,
  Loader2,
  Mail,
  School,
  Shield,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { instituteLoginPageUrl } from "@/lib/tenant";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRESET_COUNTS = [100, 250, 500, 1000, 2500, 5000];

function formatInr(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "bg-zinc-200" };
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[0-9]/.test(pw)) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) s += 1;
  if (s <= 1) return { score: 1, label: "Could be stronger", color: "bg-amber-400" };
  if (s <= 2) return { score: 2, label: "Good", color: "bg-primary-500" };
  if (s <= 3) return { score: 3, label: "Strong", color: "bg-emerald-500" };
  return { score: 4, label: "Excellent", color: "bg-emerald-600" };
}

const easeOut = [0.22, 1, 0.36, 1];

function InputShell({ icon: Icon, children, className = "" }) {
  return (
    <div
      className={`relative rounded-2xl border border-zinc-200/90 bg-zinc-50/50 transition focus-within:border-primary-400/80 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(111,163,113,0.12)] ${className}`}
    >
      {Icon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-zinc-400">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [rate, setRate] = useState(30);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    studentCount: "",
    adminFullName: "",
    adminEmail: "",
    adminUsername: "",
    adminPassword: "",
  });

  const steps = useMemo(
    () => [
      { key: "institute", title: "Institute", icon: Building2 },
      { key: "scale", title: "Scale & brand", icon: Users },
      { key: "admin", title: "Admin", icon: UserRound },
      { key: "review", title: "Review", icon: Shield },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/public/pricing`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && typeof data.amountPerStudentMonth === "number") {
          setRate(data.amountPerStudentMonth);
        }
      } catch {
        /* keep default */
      } finally {
        if (!cancelled) setLoadingPricing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLogoPreviewFailed(false);
  }, [form.logoUrl]);

  const studentNum = useMemo(() => {
    const n = parseInt(String(form.studentCount).replace(/\s/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }, [form.studentCount]);

  const estimatedMonthly = studentNum > 0 ? studentNum * rate : 0;
  const slugValid = SLUG_RE.test(form.slug.trim());
  const previewUrl = useMemo(() => {
    const s = form.slug.trim().toLowerCase();
    if (!s || !SLUG_RE.test(s)) return null;
    return instituteLoginPageUrl(s);
  }, [form.slug]);

  const pwStrength = passwordStrength(form.adminPassword);

  const stepValid = useCallback(
    (i) => {
      if (i === 0) {
        return form.name.trim().length > 0 && slugValid;
      }
      if (i === 1) {
        return studentNum >= 1 && studentNum <= 500000;
      }
      if (i === 2) {
        return (
          form.adminFullName.trim().length > 0 &&
          EMAIL_RE.test(form.adminEmail.trim()) &&
          form.adminUsername.trim().length >= 2 &&
          form.adminPassword.length >= 8
        );
      }
      if (i === 3) {
        return stepValid(0) && stepValid(1) && stepValid(2);
      }
      return true;
    },
    [
      form.name,
      form.slug,
      form.adminFullName,
      form.adminEmail,
      form.adminUsername,
      form.adminPassword,
      slugValid,
      studentNum,
    ]
  );

  const go = (next, direction) => {
    setDir(direction);
    setStep(next);
  };

  const goNext = () => {
    if (!stepValid(step)) {
      toast.error("Please complete this step before continuing");
      return;
    }
    if (step < steps.length - 1) go(step + 1, 1);
  };

  const goBack = () => {
    if (step > 0) go(step - 1, -1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stepValid(3)) {
      toast.error("Please review your details");
      return;
    }
    setSubmitting(true);
    try {
      const slugFinal = form.slug.trim().toLowerCase();
      const loginUrl = instituteLoginPageUrl(slugFinal);
      const res = await fetch(`${apiBase}/api/public/self-onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: slugFinal,
          logoUrl: form.logoUrl.trim() || undefined,
          studentCount: studentNum,
          adminFullName: form.adminFullName.trim(),
          adminEmail: form.adminEmail.trim().toLowerCase(),
          adminUsername: form.adminUsername.trim().toLowerCase(),
          adminPassword: form.adminPassword,
          loginUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Onboarding failed");
      }
      const slug = data.institution?.slug;
      setDone({
        institution: data.institution,
        billing: data.billing,
        loginUrl: instituteLoginPageUrl(slug),
        welcomeEmailSent: data.welcomeEmailSent === true,
        adminEmail: form.adminEmail.trim().toLowerCase(),
      });
      toast.success("Your institute is ready");
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.35, ease: easeOut };

  const slideVariants = reduceMotion
    ? { initial: false, animate: {}, exit: {} }
    : {
        initial: (d) => ({ opacity: 0, x: d > 0 ? 28 : -28 }),
        animate: { opacity: 1, x: 0 },
        exit: (d) => ({ opacity: 0, x: d < 0 ? 28 : -28 }),
      };

  const progress = ((step + 1) / steps.length) * 100;

  const copyLogin = () => {
    if (!done?.loginUrl) return;
    navigator.clipboard.writeText(done.loginUrl).then(
      () => {
        setUrlCopied(true);
        toast.success("Link copied");
        setTimeout(() => setUrlCopied(false), 2000);
      },
      () => toast.error("Could not copy")
    );
  };

  if (done) {
    return (
      <div className="relative min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          aria-hidden
          style={{
            background:
              "radial-gradient(1000px 520px at 15% -10%, rgba(111, 163, 113, 0.2), transparent 50%), radial-gradient(800px 420px at 95% 10%, rgba(99, 102, 241, 0.08), transparent 45%), radial-gradient(600px 400px at 50% 100%, rgba(111, 163, 113, 0.06), transparent 40%)",
          }}
        />
        {!reduceMotion && (
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
            {[...Array(8)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-primary-400/25"
                style={{
                  width: 6 + (i % 3) * 4,
                  height: 6 + (i % 3) * 4,
                  left: `${10 + i * 11}%`,
                  top: `${20 + (i * 17) % 50}%`,
                }}
                animate={{
                  y: [0, -12, 0],
                  opacity: [0.35, 0.7, 0.35],
                }}
                transition={{
                  duration: 4 + i * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        )}

        <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/55">
          <div className="mx-auto flex h-[3.75rem] max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link
              href="/"
              className="group flex items-center gap-2.5 rounded-xl py-1 pr-2 transition hover:bg-zinc-100/80"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-600/25 ring-4 ring-white">
                <School className="h-5 w-5 text-white" aria-hidden />
              </span>
              <div className="leading-tight">
                <span className="block text-sm font-bold text-zinc-900">mAI-school</span>
                <span className="block text-[11px] font-medium text-primary-700">Onboarding complete</span>
              </div>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Home
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-16">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-8 shadow-xl shadow-zinc-200/50 ring-1 ring-zinc-100/80 backdrop-blur-sm sm:p-10"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-primary-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-12 h-36 w-36 rounded-full bg-emerald-200/30 blur-3xl" />
            <div className="pointer-events-none absolute right-8 top-24 h-20 w-20 rounded-full bg-violet-200/25 blur-2xl" />

            <div className="relative flex justify-center">
              <motion.span
                initial={reduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.08 }}
                className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-600 text-white shadow-lg shadow-primary-600/30 ring-4 ring-primary-100"
              >
                {!reduceMotion && (
                  <motion.span
                    className="absolute inset-0 rounded-2xl bg-white/20"
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 1.35, opacity: 0 }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
                  />
                )}
                <Sparkles className="relative h-8 w-8" aria-hidden />
              </motion.span>
            </div>

            <p className="relative mt-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-primary-700">
              Success
            </p>
            <h1 className="relative mt-2 text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              You&apos;re live
            </h1>
            <p className="relative mt-3 text-center text-sm leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-900">{done.institution?.name}</span> is ready.
              Bookmark this link—staff and students always sign in here, not on the main marketing
              site.
            </p>

            {done.welcomeEmailSent && done.adminEmail ? (
              <p className="relative mt-4 flex items-start justify-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-center text-sm text-emerald-900">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  We emailed your <strong>sign-in link</strong>, <strong>username</strong>, and{" "}
                  <strong>password</strong> to{" "}
                  <span className="font-mono font-semibold">{done.adminEmail}</span>.
                </span>
              </p>
            ) : (
              <p className="relative mt-4 text-center text-xs text-zinc-500">
                Didn&apos;t get an email? Check spam or ask your host to configure SMTP—your link and
                credentials are still available below.
              </p>
            )}

            <motion.div
              layout
              className="relative mt-8 rounded-2xl border border-primary-100 bg-gradient-to-b from-primary-50/90 to-white p-5 shadow-inner shadow-primary-900/5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-800/80">
                  Your login URL
                </p>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-800">
                  Tap to copy
                </span>
              </div>
              <p className="mt-3 break-all font-mono text-sm leading-relaxed text-zinc-800">
                {done.loginUrl}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <motion.button
                  type="button"
                  onClick={copyLogin}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary-200/80 bg-white px-4 text-sm font-semibold text-primary-900 shadow-sm transition hover:border-primary-300 hover:bg-primary-50/80"
                >
                  {urlCopied ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                  {urlCopied ? "Copied to clipboard" : "Copy login URL"}
                </motion.button>
                <motion.a
                  href={done.loginUrl || "/login"}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-emerald-600 px-4 text-sm font-bold text-white shadow-md shadow-primary-600/25 transition hover:from-primary-700 hover:to-emerald-700"
                >
                  Open sign in
                </motion.a>
              </div>
            </motion.div>

            <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50/90 px-4 py-3 text-center text-sm text-zinc-600">
              <IndianRupee className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
              <span>
                Est. monthly{" "}
                <strong className="text-zinc-900">
                  {formatInr(done.billing?.estimatedMonthlyInr ?? 0)}
                </strong>
                <span className="text-zinc-500">
                  {" "}
                  · {done.billing?.estimatedStudents?.toLocaleString("en-IN")} students ×{" "}
                  {formatInr(done.billing?.amountPerStudentMonth ?? rate)}
                </span>
              </span>
            </div>

            <div className="relative mt-8 flex justify-center">
              <Link
                href="/"
                className="text-sm font-semibold text-zinc-500 underline decoration-zinc-300 underline-offset-4 transition hover:text-zinc-800"
              >
                Back to marketing site
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-zinc-50 text-zinc-900 antialiased">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(1000px 520px at 15% -10%, rgba(111, 163, 113, 0.2), transparent 50%), radial-gradient(800px 420px at 95% 10%, rgba(99, 102, 241, 0.08), transparent 45%), radial-gradient(600px 400px at 50% 100%, rgba(111, 163, 113, 0.06), transparent 40%)",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/55">
        <div className="mx-auto flex h-[3.75rem] max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2.5 rounded-xl py-1 pr-2 transition hover:bg-zinc-100/80"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-600/25 ring-4 ring-white">
              <School className="h-5 w-5 text-white" aria-hidden />
            </span>
            <div className="min-w-0 leading-tight">
              <span className="block text-sm font-bold tracking-tight text-zinc-900">mAI-school</span>
              <span className="block text-[11px] font-medium text-zinc-500">Self-serve onboarding</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="hidden rounded-full px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 sm:block"
            >
              Platform admin
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Exit
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:pb-24">
        <div className="mb-8 text-center lg:mx-auto lg:max-w-xl lg:text-left">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700"
          >
            Get started in minutes
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl"
          >
            Create your institute
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base"
          >
            {loadingPricing ? (
              "Loading pricing…"
            ) : (
              <>
                Simple pricing at{" "}
                <span className="font-semibold text-zinc-800">{formatInr(rate)}</span> per student
                per month. We bill the higher of enrolled students or the headcount you declare.
              </>
            )}
          </motion.p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 lg:mx-auto lg:max-w-3xl">
          <div
            className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200/90 p-px shadow-inner"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-label="Onboarding progress"
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-emerald-500"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.45, ease: easeOut }}
            />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
            {steps.map((s, i) => {
              const active = i === step;
              const complete = i < step;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    if (i < step || (i > step && [...Array(i)].every((_, j) => stepValid(j)))) {
                      go(i, i > step ? 1 : -1);
                    }
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition sm:flex-row sm:justify-center sm:gap-2 sm:px-3 ${
                    active
                      ? "border-primary-300 bg-white shadow-md shadow-primary-900/5 ring-2 ring-primary-500/20"
                      : complete
                        ? "border-primary-100 bg-primary-50/50 hover:bg-primary-50"
                        : "border-zinc-200/80 bg-white/60 hover:border-zinc-300"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                      active
                        ? "bg-primary-600 text-white shadow-sm"
                        : complete
                          ? "bg-primary-100 text-primary-800"
                          : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {complete ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : i + 1}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider sm:text-xs ${
                      active ? "text-primary-900" : "text-zinc-500"
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
          <form
            onSubmit={step === steps.length - 1 ? handleSubmit : (e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (step === steps.length - 1) return;
              const tag = e.target?.tagName;
              if (tag === "TEXTAREA") return;
              e.preventDefault();
              goNext();
            }}
            className="relative min-h-[420px] overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-6 shadow-xl shadow-zinc-200/50 ring-1 ring-zinc-100/80 backdrop-blur-sm sm:p-8 lg:min-h-[480px]"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-100/50 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-violet-100/40 blur-3xl" />

            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div
                key={step}
                custom={dir}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
                className="relative space-y-5"
              >
                {step === 0 && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
                        <Building2 className="h-5 w-5" aria-hidden />
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-zinc-900">Your institute</h2>
                        <p className="text-sm text-zinc-500">Name and the subdomain for sign-in.</p>
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Institute name
                      </span>
                      <InputShell icon={School}>
                        <input
                          required
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-4 text-sm outline-none ring-0 placeholder:text-zinc-400"
                          placeholder="e.g. Riverside International School"
                          maxLength={200}
                          autoFocus
                        />
                      </InputShell>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Subdomain slug
                      </span>
                      <InputShell icon={Link2}>
                        <input
                          required
                          pattern="[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?"
                          title="Lowercase letters, numbers, hyphens"
                          value={form.slug}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                            }))
                          }
                          className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-4 font-mono text-sm outline-none placeholder:text-zinc-400"
                          placeholder="greenfield-high"
                        />
                      </InputShell>
                      {form.slug && !slugValid && (
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          Use lowercase letters, numbers, and hyphens only (no leading/trailing
                          hyphen).
                        </p>
                      )}
                      {previewUrl && (
                        <motion.p
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 flex items-start gap-2 rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2.5 text-xs text-primary-900"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                          <span>
                            <span className="font-semibold">Preview:</span>{" "}
                            <span className="break-all font-mono text-primary-800">{previewUrl}</span>
                          </span>
                        </motion.p>
                      )}
                    </label>
                  </>
                )}

                {step === 1 && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <Users className="h-5 w-5" aria-hidden />
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-zinc-900">Scale &amp; branding</h2>
                        <p className="text-sm text-zinc-500">Headcount for billing and optional logo.</p>
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Logo URL (optional)
                      </span>
                      <InputShell icon={ImageIcon}>
                        <input
                          type="url"
                          value={form.logoUrl}
                          onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                          className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-400"
                          placeholder="https://your-cdn.com/logo.png"
                        />
                      </InputShell>
                    </label>
                    <div className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Expected students
                      </span>
                      <InputShell icon={Users}>
                        <input
                          required
                          type="number"
                          min={1}
                          max={500000}
                          step={1}
                          value={form.studentCount}
                          onChange={(e) => setForm((f) => ({ ...f, studentCount: e.target.value }))}
                          className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-4 font-mono text-sm outline-none placeholder:text-zinc-400"
                          placeholder="500"
                        />
                      </InputShell>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {PRESET_COUNTS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, studentCount: String(n) }))}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              studentNum === n
                                ? "border-primary-400 bg-primary-50 text-primary-900"
                                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                            }`}
                          >
                            {n.toLocaleString("en-IN")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                        <Shield className="h-5 w-5" aria-hidden />
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-zinc-900">First administrator</h2>
                        <p className="text-sm text-zinc-500">
                          Full access on your institute URL; you can invite staff later.
                        </p>
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Full name
                      </span>
                      <InputShell icon={UserRound}>
                        <input
                          required
                          value={form.adminFullName}
                          onChange={(e) => setForm((f) => ({ ...f, adminFullName: e.target.value }))}
                          className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-400"
                          placeholder="Priya Sharma"
                        />
                      </InputShell>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Email
                      </span>
                      <InputShell icon={Mail}>
                        <input
                          required
                          type="email"
                          autoComplete="email"
                          value={form.adminEmail}
                          onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                          className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-400"
                          placeholder="you@school.edu"
                        />
                      </InputShell>
                      <span className="mt-1.5 block text-xs text-zinc-500">
                        We&apos;ll send your sign-in link, username, and password here.
                      </span>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Username
                      </span>
                      <InputShell icon={UserRound}>
                        <input
                          required
                          autoComplete="username"
                          value={form.adminUsername}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              adminUsername: e.target.value.replace(/\s/g, ""),
                            }))
                          }
                          className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-4 font-mono text-sm outline-none placeholder:text-zinc-400"
                          placeholder="admin"
                        />
                      </InputShell>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Password
                      </span>
                      <InputShell icon={null}>
                        <div className="relative">
                          <input
                            required
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            minLength={8}
                            value={form.adminPassword}
                            onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                            className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-4 pr-12 text-sm outline-none placeholder:text-zinc-400"
                            placeholder="At least 8 characters"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" aria-hidden />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </div>
                      </InputShell>
                      {form.adminPassword.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex h-1.5 gap-1 overflow-hidden rounded-full bg-zinc-100">
                            {[1, 2, 3, 4].map((seg) => (
                              <div
                                key={seg}
                                className={`h-full flex-1 rounded-full transition-colors ${
                                  seg <= pwStrength.score ? pwStrength.color : "bg-zinc-200"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-xs font-medium text-zinc-500">{pwStrength.label}</p>
                        </div>
                      )}
                    </label>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-600 text-white shadow-md">
                        <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-zinc-900">Review &amp; launch</h2>
                        <p className="text-sm text-zinc-500">
                          Confirm details—your tenant is created immediately after submit.
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 text-sm">
                      <li className="flex justify-between gap-4 border-b border-zinc-100/80 pb-3">
                        <span className="text-zinc-500">Institute</span>
                        <span className="max-w-[60%] text-right font-semibold text-zinc-900">
                          {form.name.trim() || "—"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 border-b border-zinc-100/80 pb-3">
                        <span className="text-zinc-500">Slug</span>
                        <span className="font-mono font-medium text-zinc-800">{form.slug || "—"}</span>
                      </li>
                      <li className="flex justify-between gap-4 border-b border-zinc-100/80 pb-3">
                        <span className="text-zinc-500">Students (declared)</span>
                        <span className="font-semibold text-zinc-900">
                          {studentNum.toLocaleString("en-IN")}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 border-b border-zinc-100/80 pb-3">
                        <span className="text-zinc-500">Admin</span>
                        <span className="text-right font-medium text-zinc-900">
                          {form.adminFullName.trim()} ({form.adminUsername})
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 border-b border-zinc-100/80 pb-3">
                        <span className="text-zinc-500">Email</span>
                        <span className="max-w-[60%] break-all text-right font-medium text-zinc-900">
                          {form.adminEmail.trim()}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 pt-1">
                        <span className="text-zinc-500">Est. monthly</span>
                        <span className="font-bold text-primary-800">{formatInr(estimatedMonthly)}</span>
                      </li>
                    </ul>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="relative mt-10 flex flex-col-reverse gap-3 border-t border-zinc-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || !stepValid(3)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-600 to-emerald-600 px-6 text-sm font-bold text-white shadow-lg shadow-primary-600/25 transition hover:from-primary-700 hover:to-emerald-700 disabled:pointer-events-none disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" aria-hidden />
                      Create institute
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Live summary — desktop sticky */}
          <aside className="lg:sticky lg:top-24">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/90 p-5 shadow-lg shadow-zinc-200/40 ring-1 ring-zinc-100"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                Live preview
              </p>
              <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 text-primary-700 ring-2 ring-white">
                    {form.logoUrl && !logoPreviewFailed ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.logoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setLogoPreviewFailed(true)}
                      />
                    ) : (
                      <School className="h-6 w-6" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-zinc-900">
                      {form.name.trim() || "Your institute"}
                    </p>
                    <p className="truncate font-mono text-xs text-zinc-500">{form.slug || "slug"}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Sign-in URL
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] leading-snug text-primary-800">
                    {previewUrl || "Enter a valid slug to preview"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-3 text-white">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <IndianRupee className="h-4 w-4 text-primary-300" aria-hidden />
                  <span>Monthly (est.)</span>
                </div>
                <span className="text-lg font-bold tabular-nums">
                  {studentNum > 0 ? formatInr(estimatedMonthly) : "—"}
                </span>
              </div>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
                Step {step + 1} of {steps.length} · Keyboard-friendly flow
              </p>
            </motion.div>
          </aside>
        </div>

        <p className="mx-auto mt-10 max-w-md text-center text-xs text-zinc-500">
          Need help or enterprise terms?{" "}
          <a
            href="mailto:?subject=mAI-school%20%E2%80%94%20Onboarding%20help"
            className="font-semibold text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-800"
          >
            Contact us
          </a>
        </p>
      </main>
    </div>
  );
}
