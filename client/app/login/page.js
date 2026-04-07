"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  School,
  Sparkles,
  User,
} from "lucide-react";
import {
  resolveTenantSlugForLogin,
  tenantAppPath,
} from "@/lib/tenant";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
const easeOut = [0.22, 1, 0.36, 1];

function LoginInputShell({ icon: Icon, children }) {
  return (
    <div className="relative rounded-2xl border border-zinc-200/90 bg-zinc-50/50 transition focus-within:border-primary-400/80 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(111,163,113,0.12)]">
      {Icon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-zinc-400">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      {children}
    </div>
  );
}

const tipVariants = {
  hidden: { opacity: 0, y: 12 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.4, ease: easeOut },
  }),
};

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const [institution, setInstitution] = useState(null);
  const [institutionLoadError, setInstitutionLoadError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [instLoading, setInstLoading] = useState(true);

  useEffect(() => {
    const slug = resolveTenantSlugForLogin(
      window.location.hostname,
      window.location.search,
      pathname || ""
    );
    setTenantSlug(slug);
    if (!slug) {
      setInstitution(null);
      setInstitutionLoadError("");
      setInstLoading(false);
      return;
    }
    let cancelled = false;
    setInstLoading(true);
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/public/institution/${encodeURIComponent(slug)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setInstitution(null);
          setInstitutionLoadError(data.error || "Could not load this institute.");
          return;
        }
        setInstitution({
          name: data.name,
          slug: data.slug,
          logo_url: data.logo_url,
        });
        setInstitutionLoadError("");
      } catch {
        if (!cancelled) {
          setInstitution(null);
          setInstitutionLoadError("Could not load institute details.");
        }
      } finally {
        if (!cancelled) setInstLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const isMaiLoginHost = !tenantSlug;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const institution_slug =
        resolveTenantSlugForLogin(
          window.location.hostname,
          window.location.search,
          pathname || ""
        ) || null;
      const res = await fetch(`${apiBase}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          institution_slug,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.institution) {
          localStorage.setItem("institution", JSON.stringify(data.institution));
        } else {
          localStorage.removeItem("institution");
        }

        const navSlug = data.institution?.slug || institution_slug || "";
        if (data.role === "mai_admin") {
          router.push("/mai-admin");
        } else if (data.role === "admin") {
          router.push(tenantAppPath(navSlug, "/admin"));
        } else if (data.role === "teacher") {
          router.push(tenantAppPath(navSlug, "/teacher"));
        } else if (data.role === "principal") {
          router.push(tenantAppPath(navSlug, "/principal"));
        } else if (data.role === "student") {
          router.push(tenantAppPath(navSlug, "/student"));
        }
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-zinc-50 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-zinc-900 antialiased">
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
          <motion.div
            className="absolute -left-20 top-32 h-64 w-64 rounded-full bg-primary-200/30 blur-3xl"
            animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.55, 0.4] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -right-16 bottom-24 h-56 w-56 rounded-full bg-violet-200/25 blur-3xl"
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.5, 0.35] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/55">
        <div className="mx-auto flex min-h-[3.75rem] max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:gap-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-xl py-1 pr-2 transition hover:bg-zinc-100/80">
            {isMaiLoginHost ? (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-md ring-4 ring-white">
                  <School className="h-5 w-5 text-white" aria-hidden />
                </span>
                <div className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-bold text-zinc-900">mAI-school</span>
                  <span className="block text-[11px] font-medium text-zinc-500">Platform sign in</span>
                </div>
              </>
            ) : institution?.logo_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={institution.logo_url}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-md ring-4 ring-white"
                />
                <span className="truncate text-sm font-bold text-zinc-900">{institution.name}</span>
              </>
            ) : (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-600/25 ring-4 ring-white">
                  <School className="h-5 w-5 text-white" aria-hidden />
                </span>
                <span className="truncate text-sm font-bold text-zinc-900">
                  {institution?.name || (instLoading ? "Loading…" : "Institute")}
                </span>
              </>
            )}
          </Link>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Home
          </Link>
        </div>
      </header>

      <main
        className={
          isMaiLoginHost
            ? "mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_minmax(0,440px)] lg:items-center lg:gap-14 lg:px-8 lg:py-16"
            : "mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-[440px] flex-col justify-center px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-12"
        }
      >
        {isMaiLoginHost && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: easeOut }}
            className="order-2 lg:order-1"
          >
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700">
                  Platform
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  MAI administrator access
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 sm:text-base">
                  Sign in here to onboard institutes, manage tenants, and review billing.                   School
                  staff should use their institute sign-in link—not this page.
                </p>
              </div>
              <ul className="space-y-3">
                {[
                  "Multi-tenant control and institute activation",
                  "Per-user login toggles and usage visibility",
                  "Manual onboarding when you need a white-glove setup",
                ].map((line, i) => (
                  <motion.li
                    key={line}
                    custom={i}
                    variants={tipVariants}
                    initial="hidden"
                    animate="show"
                    className="flex gap-3 rounded-2xl border border-zinc-100 bg-white/70 px-4 py-3 text-sm text-zinc-700 shadow-sm backdrop-blur-sm"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden />
                    {line}
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: isMaiLoginHost ? 0.06 : 0, ease: easeOut }}
          className={isMaiLoginHost ? "order-1 lg:order-2" : "w-full"}
        >
          {isMaiLoginHost && (
            <div className="mb-6 text-center lg:text-left">
              <motion.div
                initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  reduceMotion ? {} : { type: "spring", stiffness: 280, damping: 22, delay: 0.1 }
                }
                className="mx-auto mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-lg shadow-zinc-900/20 ring-4 ring-white lg:mx-0"
              >
                <School className="h-9 w-9 text-white" aria-hidden />
              </motion.div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
                Sign in to platform
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                MAI technical administrator credentials only.
              </p>
            </div>
          )}

          {!isMaiLoginHost && (
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                Sign in
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                {instLoading
                  ? "Loading…"
                  : institution
                    ? "Use the username and password from your school."
                    : institutionLoadError || "Unable to load institute."}
              </p>
            </div>
          )}

          {!isMaiLoginHost && institutionLoadError && !institution ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[1.5rem] border border-amber-200/90 bg-gradient-to-b from-amber-50 to-white p-6 text-center shadow-lg shadow-amber-900/5"
            >
              <p className="text-sm font-medium text-amber-950">{institutionLoadError}</p>
              <p className="mt-2 text-xs leading-relaxed text-amber-900/80">
                Ask your school for the correct sign-in link.
              </p>
              <div className="mt-5 flex justify-center">
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-amber-200 bg-white px-6 text-sm font-semibold text-amber-950 transition hover:bg-amber-50"
                >
                  Go to main site
                </Link>
              </div>
            </motion.div>
          ) : (
            <div className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-6 shadow-xl shadow-zinc-200/50 ring-1 ring-zinc-100/80 backdrop-blur-sm sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary-100/60 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-violet-100/40 blur-3xl" />

              <form onSubmit={handleSubmit} className="relative space-y-5">
                <label className="block" htmlFor="login-username">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Username
                  </span>
                  <LoginInputShell icon={User}>
                    <input
                      id="login-username"
                      type="text"
                      autoComplete="username"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-4 text-sm outline-none ring-0 placeholder:text-zinc-400"
                      placeholder="your.username"
                      required
                    />
                  </LoginInputShell>
                </label>

                <label className="block" htmlFor="login-password">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Password
                  </span>
                  <LoginInputShell icon={null}>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-zinc-400">
                        <Lock className="h-5 w-5" aria-hidden />
                      </span>
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        className="h-12 w-full rounded-2xl border-0 bg-transparent py-3 pl-11 pr-12 text-sm outline-none ring-0 placeholder:text-zinc-400"
                        placeholder="••••••••"
                        required
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
                  </LoginInputShell>
                </label>

                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      key={error}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      role="alert"
                      className="overflow-hidden rounded-2xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm font-medium text-red-800"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={
                    loading ||
                    (!isMaiLoginHost &&
                      (instLoading || (!institution && !!institutionLoadError)))
                  }
                  whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-600 to-emerald-600 text-sm font-bold text-white shadow-lg shadow-primary-600/25 transition hover:from-primary-700 hover:to-emerald-700 disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      Signing in…
                    </>
                  ) : (
                    <>
                      {isMaiLoginHost ? (
                        <Sparkles className="h-4 w-4 opacity-90" aria-hidden />
                      ) : (
                        <LogIn className="h-4 w-4 opacity-90" aria-hidden />
                      )}
                      Sign in
                    </>
                  )}
                </motion.button>
              </form>

              {isMaiLoginHost && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="relative mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/90 p-4"
                >
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                    Try demo
                  </p>
                  <p className="mt-2 text-center text-sm text-zinc-600">
                    <span className="font-mono font-semibold text-zinc-900">mai_admin</span>
                    <span className="mx-1 text-zinc-400">/</span>
                    <span className="font-mono font-semibold text-zinc-900">mai_admin123</span>
                  </p>
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-zinc-500">
                    School users: use your institute sign-in link from your admin.
                  </p>
                </motion.div>
              )}
            </div>
          )}

          <p
            className={`mt-8 text-center text-xs text-zinc-500 ${isMaiLoginHost ? "lg:text-left" : ""}`}
          >
            © {new Date().getFullYear()} mAI-school
          </p>
        </motion.div>
      </main>
    </div>
  );
}
