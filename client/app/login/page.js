"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Lock, School, User } from "lucide-react";
import { institutionSlugFromHostname } from "@/lib/tenant";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export default function LoginPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const [institution, setInstitution] = useState(null);
  const [institutionLoadError, setInstitutionLoadError] = useState("");

  useEffect(() => {
    const slug = institutionSlugFromHostname(window.location.hostname);
    setTenantSlug(slug);
    if (!slug) {
      setInstitution(null);
      setInstitutionLoadError("");
      return;
    }
    let cancelled = false;
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isMaiLoginHost = !tenantSlug;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const slugFromHost = institutionSlugFromHostname(window.location.hostname);
      const institution_slug = slugFromHost ? slugFromHost : null;
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

        if (data.role === "mai_admin") {
          router.push("/mai-admin");
        } else if (data.role === "admin") {
          router.push("/admin");
        } else if (data.role === "teacher") {
          router.push("/teacher");
        } else if (data.role === "principal") {
          router.push("/principal");
        } else if (data.role === "student") {
          router.push("/student");
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

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
      };

  const brandIcon = (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-500/25 ring-4 ring-white">
      <School className="h-5 w-5 text-white" aria-hidden />
    </span>
  );

  const maiIcon = (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-md ring-4 ring-white">
      <School className="h-5 w-5 text-white" aria-hidden />
    </span>
  );

  return (
    <div className="relative min-h-screen bg-zinc-50 text-zinc-900 antialiased">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 480px at 50% -15%, rgba(136, 179, 138, 0.2), transparent 55%), radial-gradient(700px 360px at 100% 0%, rgba(99, 102, 241, 0.06), transparent 45%), radial-gradient(600px 400px at 0% 100%, rgba(136, 179, 138, 0.08), transparent 50%)",
        }}
      />

      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/75 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            {isMaiLoginHost ? (
              <>
                {maiIcon}
                <span className="text-base font-semibold tracking-tight text-zinc-900">
                  mAI-school · Platform
                </span>
              </>
            ) : institution?.logo_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={institution.logo_url}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-2xl object-cover ring-4 ring-white shadow-md"
                />
                <span className="truncate text-base font-semibold tracking-tight text-zinc-900">
                  {institution.name}
                </span>
              </>
            ) : (
              <>
                {brandIcon}
                <span className="truncate text-base font-semibold tracking-tight text-zinc-900">
                  {institution?.name || "mAI-school"}
                </span>
              </>
            )}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Home
          </Link>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-4.25rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <motion.div {...motionProps} className="w-full max-w-[420px]">
          <div className="mb-8 text-center">
            <motion.div
              initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { delay: 0.06, type: "spring", stiffness: 260, damping: 22 }
              }
              className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl shadow-lg ring-4 ring-white ${
                isMaiLoginHost
                  ? "bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-zinc-900/25"
                  : "bg-gradient-to-br from-primary-500 to-primary-700 shadow-primary-500/30"
              }`}
            >
              {isMaiLoginHost ? (
                <School className="h-8 w-8 text-white" aria-hidden />
              ) : institution?.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={institution.logo_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <School className="h-8 w-8 text-white" aria-hidden />
              )}
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 sm:text-base">
              {isMaiLoginHost
                ? "MAI technical administrator sign-in (main platform only)"
                : institution
                  ? `Sign in to ${institution.name}`
                  : institutionLoadError
                    ? institutionLoadError
                    : "Loading institute…"}
            </p>
            {!isMaiLoginHost && institution?.slug && (
              <p className="mt-1 font-mono text-xs text-zinc-500">{institution.slug}</p>
            )}
          </div>

          {!isMaiLoginHost && institutionLoadError && !institution ? (
            <div className="rounded-3xl border border-amber-200/90 bg-amber-50/90 px-4 py-4 text-center text-sm text-amber-900">
              Check the URL or contact your administrator. Use your school’s subdomain link to sign in.
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xl shadow-zinc-200/50 ring-1 ring-zinc-100 sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary-100/50 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-12 h-36 w-36 rounded-full bg-violet-100/35 blur-3xl" />

              <form onSubmit={handleSubmit} className="relative space-y-5">
                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-2 block text-sm font-semibold text-zinc-800"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                      <User className="h-5 w-5" aria-hidden />
                    </span>
                    <input
                      id="login-username"
                      type="text"
                      autoComplete="username"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 py-3 pl-11 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-500/15"
                      placeholder="Enter your username"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-2 block text-sm font-semibold text-zinc-800"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Lock className="h-5 w-5" aria-hidden />
                    </span>
                    <input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 py-3 pl-11 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-500/15"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-800"
                  >
                    {error}
                  </motion.div>
                )}

                <motion.button
                  type="submit"
                  disabled={loading || (!isMaiLoginHost && !institution && !!institutionLoadError)}
                  whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg
                        className="h-5 w-5 animate-spin text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </motion.button>
              </form>

              <div className="relative mt-6 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Demo access
                </p>
                {isMaiLoginHost ? (
                  <p className="mt-2 text-sm text-zinc-600">
                    MAI admin only on this page:{" "}
                    <span className="font-mono font-semibold text-zinc-900">mai_admin</span> /{" "}
                    <span className="font-mono font-semibold text-zinc-900">mai_admin123</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600">
                    Institute demo:{" "}
                    <span className="font-mono font-semibold text-zinc-900">admin</span> /{" "}
                    <span className="font-mono font-semibold text-zinc-900">admin123</span>{" "}
                    <span className="text-zinc-400">(demo tenant)</span>
                  </p>
                )}
                <p className="mt-2 text-xs text-zinc-500">
                  {isMaiLoginHost
                    ? "School staff and students: open your institute subdomain (e.g. your-school.example.com)."
                    : "MAI administrators: use the main platform URL, not this school page."}
                </p>
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-zinc-500">
            © {new Date().getFullYear()} mAI-school. All rights reserved.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
