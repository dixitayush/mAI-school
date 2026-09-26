"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from "lucide-react";
import { apiBase } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase()}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-xl shadow-zinc-200/30">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold text-zinc-900">Check your email</h1>
              <p className="mt-2 text-sm text-zinc-500">
                If an account exists for <span className="font-medium text-zinc-700">{email}</span>, we&apos;ve sent a password reset link. It expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                <ArrowLeft className="h-4 w-4" /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
                  <Mail className="h-6 w-6 text-primary-600" />
                </div>
                <h1 className="text-xl font-bold text-zinc-900">Forgot password?</h1>
                <p className="mt-1 text-sm text-zinc-500">Enter your email and we&apos;ll send a reset link.</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send reset link
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link href="/login" className="text-sm font-medium text-zinc-500 hover:text-zinc-700">
                  <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
