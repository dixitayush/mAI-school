"use client";

import Link from "next/link";
import { Outfit, Manrope } from "next/font/google";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Globe,
  GraduationCap,
  Headphones,
  HelpCircle,
  LineChart,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  Minus,
  PenLine,
  Phone,
  Plus,
  School,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-landing-display",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-landing-body",
  display: "swap",
});

const LANDING_NAV_LINKS = [
  ["#about", "Product"],
  ["#how-it-works", "How it works"],
  ["#features", "Features"],
  ["#pricing", "Pricing"],
  ["#faq", "FAQ"],
];

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};

const productFeatures = [
  {
    icon: ClipboardCheck,
    title: "Attendance everyone can trust",
    description:
      "Mark and review attendance with clarity—teachers save time and parents stay in the loop without chasing paper.",
  },
  {
    icon: PenLine,
    title: "Exams & academics in one flow",
    description:
      "Plan assessments, capture results, and give leadership a clear read on progress across classes and terms.",
  },
  {
    icon: Wallet,
    title: "Fees without the friction",
    description:
      "Track what is due, what is paid, and who needs a nudge—finance teams see the picture; families see transparency.",
  },
  {
    icon: MessageSquare,
    title: "Announcements that land",
    description:
      "Share updates with the right people at the right time, tied to your school—not lost in group chats.",
  },
  {
    icon: Globe,
    title: "Your institute’s own sign-in",
    description:
      "Each school gets a dedicated subdomain and optional branding. Staff and students use your link; MAI ops stay on the main site.",
  },
  {
    icon: Users,
    title: "Spaces for every role",
    description:
      "Admins, principals, teachers, and students each get a focused home—less noise, more of the work that matters.",
  },
  {
    icon: CalendarDays,
    title: "Timetables & online classes",
    description:
      "Publish schedules and run virtual sessions from the same platform your campus already uses day to day.",
  },
  {
    icon: Sparkles,
    title: "Helpful AI for your staff",
    description:
      "Smart assists for drafting, summarizing, and everyday tasks—so your team spends energy on students, not busywork.",
  },
];

const audienceRoles = [
  {
    id: "admin",
    label: "Admins",
    icon: Building2,
    title: "Run the institute from one calm desk",
    body: "Classes, people, fees, announcements, and settings—without hopping between spreadsheets and messaging apps.",
    points: [
      "Invite staff with the right roles",
      "Configure fee plans and track collections",
      "See attendance and academic pulse at a glance",
    ],
  },
  {
    id: "principal",
    label: "Principals",
    icon: LineChart,
    title: "Leadership visibility without the chase",
    body: "Understand what’s happening across grades—attendance trends, fee health, and what needs attention today.",
    points: [
      "Campus-wide overview, not raw dumps",
      "Fewer status meetings that rehash the same numbers",
      "Clear ownership when something slips",
    ],
  },
  {
    id: "teacher",
    label: "Teachers",
    icon: BookOpen,
    title: "Tools that respect classroom time",
    body: "Mark attendance, enter results, share assignments, and stay aligned with the office—without another login maze.",
    points: [
      "Fast attendance and marks entry",
      "Assignments and online class links in context",
      "Announcements that reach the right classes",
    ],
  },
  {
    id: "student",
    label: "Students",
    icon: GraduationCap,
    title: "A clear home for school life",
    body: "See fees, results, timetable, and messages in one place—on your school’s subdomain, with your credentials.",
    points: [
      "Know what’s due and what’s next",
      "Access online classes and schedules",
      "Stay informed without hunting chats",
    ],
  },
];

const onboardingSteps = [
  {
    step: 1,
    icon: Phone,
    title: "Choose how you start",
    description:
      "Start online in minutes with self-serve onboarding—or talk to sales for a guided contract and white-glove setup.",
    bullets: [
      "Self-serve: ₹30 INR per student per month, tenant created instantly",
      "Sales-led: same platform, with scope, commercials, and kickoff on your calendar",
      "Either way you get a dedicated subdomain and isolated institute data",
    ],
  },
  {
    step: 2,
    icon: PenLine,
    title: "Tell us about your institute",
    description:
      "Share your name, subdomain slug, optional logo, expected student count, and first admin details.",
    bullets: [
      "Name and slug become your branded sign-in URL",
      "Optional logo on the institute login page",
      "Admin email receives credentials in mAI-school style",
    ],
  },
  {
    step: 3,
    icon: UserPlus,
    title: "We provision your tenant",
    description:
      "Your institute appears on the platform—own subdomain, isolated data, and a shareable login URL for your team.",
    bullets: [
      "Dedicated subdomain and optional branding",
      "Primary institute admin credentials to your designated lead",
      "MAI operations use the main platform; your campus uses your school link only",
    ],
  },
  {
    step: 4,
    icon: GraduationCap,
    title: "You roll out to campus",
    description:
      "Your admin signs in, invites staff, configures classes and fees, and goes live—supported by us when you need it.",
    bullets: [
      "Everyone signs in on your subdomain—not the marketing site",
      "Invite teachers, principals, and staff with the right roles",
      "Configure classes, fees, and announcements at your pace",
    ],
  },
];

const pricingPlans = [
  {
    id: "self",
    name: "Self-serve",
    badge: "Start today",
    priceLabel: "₹30",
    priceSuffix: "per student / month",
    description:
      "Create your institute online in minutes. Instant tenant, subdomain, and first admin—ideal when you want to move fast.",
    highlights: [
      "Instant provisioning & subdomain",
      "Attendance, fees, exams, announcements",
      "Role-based spaces for your campus",
      "Billable headcount = max(enrolled, declared estimate)",
    ],
    cta: { href: "/onboarding", label: "Start online", external: false },
    featured: true,
  },
  {
    id: "sales",
    name: "Sales-led",
    badge: "Guided setup",
    priceLabel: "Custom",
    priceSuffix: "scoped to your campus",
    description:
      "Talk to us for commercials, rollout planning, and white-glove onboarding matched to your academic calendar.",
    highlights: [
      "Kickoff with sales & technical specialists",
      "Scope and timeline you can plan around",
      "Same product, hands-on go-live support",
      "Ideal for larger or multi-campus institutes",
    ],
    cta: {
      href: "mailto:?subject=mAI-school%20%E2%80%94%20Talk%20to%20sales",
      label: "Contact sales",
      external: true,
    },
    featured: false,
  },
];

const faqItems = [
  {
    q: "What is mAI-school?",
    a: "mAI-school is a multi-tenant school management platform. Each institute gets its own subdomain, optional branding, and isolated data—while attendance, fees, exams, communication, and day-to-day operations live in one place.",
  },
  {
    q: "How do schools sign in?",
    a: "Staff and students use the institute’s own subdomain URL (the link your school shares). Platform administrators sign in on the main mAI-school site. Marketing and onboarding live on the apex domain—not on your campus login.",
  },
  {
    q: "How does pricing work?",
    a: "Self-serve institutes are billed at ₹30 INR per student per month. Billable headcount is the higher of enrolled students or the estimate you declare at signup. Sales-led deals can be scoped to your campus—ask us for details.",
  },
  {
    q: "Can we start without talking to sales?",
    a: "Yes. Use Start online to create your tenant immediately: institute name, slug, optional logo, student estimate, and first admin. You’ll get a shareable login URL and credentials on screen and by email.",
  },
  {
    q: "Is each school’s data separate?",
    a: "Yes. Tenants are isolated end to end—attendance, fees, users, and settings don’t mix with other institutes. Sign-in happens on your school’s host, not a shared generic portal.",
  },
  {
    q: "Who is the product for?",
    a: "Institute admins, principals, teachers, and students. Each role gets a focused home so people see the work that matters to them—without the noise of everyone else’s tools.",
  },
  {
    q: "What’s on the roadmap?",
    a: "In-app billing, invoices, and richer automated payments are planned. Student-based pricing at ₹30/student/month is available for self-serve today. Ask sales for timing in your region.",
  },
  {
    q: "How do we get help?",
    a: "Email us from any Contact sales link on this page. Self-serve institutes can also reach out after go-live; sales-led customers get kickoff and technical specialists through provisioning.",
  },
];

const trustPoints = [
  {
    icon: Shield,
    title: "Tenant isolation",
    text: "Your attendance, fees, and users stay on your institute—never mixed with another school.",
  },
  {
    icon: Lock,
    title: "Role-aware access",
    text: "Admins, principals, teachers, and students only see what their role needs.",
  },
  {
    icon: Headphones,
    title: "People when it matters",
    text: "Sales and technical specialists help from first conversation through go-live.",
  },
  {
    icon: Zap,
    title: "Live in minutes or on your calendar",
    text: "Self-serve provisioning today—or a guided rollout that matches your term.",
  },
];

function formatInr(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function SectionHeading({ eyebrow, title, description, light = false }) {
  return (
    <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
      <p
        className={`text-xs font-semibold uppercase tracking-[0.18em] ${
          light ? "text-primary-300" : "text-primary-700"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15] ${
          light ? "text-white" : "text-zinc-900"
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p className={`mt-4 text-base leading-relaxed sm:text-lg ${light ? "text-zinc-400" : "text-zinc-600"}`}>
          {description}
        </p>
      ) : null}
    </motion.div>
  );
}

function HowItWorksInteractive() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const tabId = useId();
  const panelId = `${tabId}-panel`;
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLargeScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduceMotion || !isLargeScreen) return undefined;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % onboardingSteps.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [reduceMotion, isLargeScreen, active]);

  const go = useCallback((index) => {
    const next = Math.max(0, Math.min(onboardingSteps.length - 1, index));
    setActive(next);
  }, []);

  const onPanelKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        go(active + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        go(active - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        go(0);
      } else if (e.key === "End") {
        e.preventDefault();
        go(onboardingSteps.length - 1);
      }
    },
    [active, go]
  );

  const current = onboardingSteps[active];
  const progress = ((active + 1) / onboardingSteps.length) * 100;
  const activeTabLabelId = isLargeScreen
    ? `${tabId}-dtab-${active}`
    : `${tabId}-mtab-${active}`;

  return (
    <div
      className="mx-auto mt-14 max-w-5xl lg:mt-16"
      role="region"
      aria-label="How institutes get started on mAI-school"
    >
      <div className="mb-8 space-y-4">
        <div
          className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200/90"
          aria-hidden
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
            }
          />
        </div>
        <div
          className="flex flex-wrap justify-center gap-2 sm:justify-between sm:gap-3 lg:hidden"
          role="tablist"
          aria-label="Onboarding steps"
        >
          {onboardingSteps.map((item, i) => {
            const isActive = i === active;
            return (
              <button
                key={item.step}
                type="button"
                role="tab"
                id={`${tabId}-mtab-${i}`}
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => go(i)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:flex-initial sm:px-4 ${
                  isActive
                    ? "border-primary-300 bg-white text-primary-900 shadow-md shadow-primary-900/5 ring-2 ring-primary-500/20"
                    : "border-zinc-200/90 bg-white/60 text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isActive ? "bg-primary-600 text-white" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {item.step}
                </span>
                <span className="hidden truncate sm:inline">{item.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-10">
        <div
          className="hidden lg:col-span-5 lg:flex lg:flex-col lg:gap-0"
          role="tablist"
          aria-label="Onboarding steps"
        >
          {onboardingSteps.map((item, i) => {
            const isActive = i === active;
            const isPast = i < active;
            return (
              <div key={item.step} className="flex gap-4">
                <div className="flex w-11 shrink-0 flex-col items-center">
                  <button
                    type="button"
                    role="tab"
                    id={`${tabId}-dtab-${i}`}
                    aria-selected={isActive}
                    aria-controls={panelId}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => go(i)}
                    className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${
                      isActive
                        ? "bg-primary-600 text-white shadow-primary-600/25 ring-4 ring-primary-100"
                        : isPast
                          ? "bg-primary-100 text-primary-800 ring-2 ring-primary-200/80 hover:bg-primary-200/80"
                          : "bg-zinc-100 text-zinc-500 ring-2 ring-transparent hover:bg-zinc-200"
                    }`}
                  >
                    {isPast ? <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden /> : item.step}
                  </button>
                  {i < onboardingSteps.length - 1 && (
                    <div className="relative mt-1 h-12 w-0.5 shrink-0" aria-hidden>
                      <div className="absolute inset-0 rounded-full bg-zinc-200" />
                      <motion.div
                        className="absolute left-0 top-0 w-full rounded-full bg-primary-400"
                        initial={false}
                        animate={{
                          height: i < active ? "100%" : i === active ? "50%" : "0%",
                        }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                        }
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => go(i)}
                  className={`group mb-2 min-w-0 flex-1 rounded-2xl border px-5 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${
                    isActive
                      ? "border-primary-200 bg-white shadow-lg shadow-zinc-200/50 ring-1 ring-primary-500/10"
                      : "border-transparent bg-transparent hover:border-zinc-200/80 hover:bg-white/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                      <item.icon className="h-5 w-5" aria-hidden />
                    </span>
                    {isActive && (
                      <ChevronRight className="h-5 w-5 shrink-0 text-primary-500" aria-hidden />
                    )}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                    {item.description}
                  </p>
                </button>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-7">
          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={activeTabLabelId}
            tabIndex={0}
            onKeyDown={onPanelKeyDown}
            className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xl shadow-zinc-200/40 outline-none ring-zinc-900/5 focus-visible:ring-2 focus-visible:ring-primary-500/30 sm:p-8 lg:min-h-[420px] lg:p-10"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary-100/60 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-emerald-100/40 blur-3xl" />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={transition}
                className="relative"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Step {current.step} of {onboardingSteps.length}
                  </span>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-md shadow-primary-600/25">
                    <current.icon className="h-6 w-6" aria-hidden />
                  </span>
                </div>
                <h3 className="mt-6 font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                  {current.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-zinc-600">{current.description}</p>
                <ul className="mt-8 space-y-3">
                  {current.bullets.map((line) => (
                    <li key={line} className="flex gap-3 text-sm text-zinc-700">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                      </span>
                      <span className="leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-10 flex flex-col gap-3 border-t border-zinc-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => go(active - 1)}
                      disabled={active === 0}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => go(active + 1)}
                      disabled={active === onboardingSteps.length - 1}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-40"
                    >
                      Next step
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    Focus this card, then use arrow keys to move between steps.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudienceTabs() {
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();
  const current = audienceRoles[active];

  return (
    <div className="mt-12">
      <div
        className="flex flex-wrap justify-center gap-2"
        role="tablist"
        aria-label="Who mAI-school is for"
      >
        {audienceRoles.map((role, i) => {
          const isActive = i === active;
          return (
            <button
              key={role.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(i)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "border-primary-500 bg-primary-600 text-white shadow-md shadow-primary-600/20"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
              }`}
            >
              <role.icon className="h-4 w-4" aria-hidden />
              {role.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-8 max-w-3xl rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-lg shadow-zinc-200/40 sm:p-10"
          role="tabpanel"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <current.icon className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h3 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold text-zinc-900 sm:text-2xl">
                {current.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-zinc-600">{current.body}</p>
              <ul className="mt-6 space-y-2.5">
                {current.points.map((p) => (
                  <li key={p} className="flex gap-3 text-sm text-zinc-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" strokeWidth={2.5} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PricingEstimator() {
  const [students, setStudents] = useState(250);
  const monthly = useMemo(() => students * 30, [students]);

  return (
    <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6 sm:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-800">Estimate your monthly cost</p>
          <p className="mt-1 text-xs text-zinc-500">Self-serve rate · ₹30 × students</p>
        </div>
        <p className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold tabular-nums text-primary-800 sm:text-3xl">
          {formatInr(monthly)}
          <span className="ml-1 text-sm font-medium text-zinc-500">/mo</span>
        </p>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          aria-label="Decrease students"
          onClick={() => setStudents((s) => Math.max(50, s - 50))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={50}
          max={2000}
          step={50}
          value={students}
          onChange={(e) => setStudents(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-primary-600"
          aria-label="Number of students"
        />
        <button
          type="button"
          aria-label="Increase students"
          onClick={() => setStudents((s) => Math.min(2000, s + 50))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 text-center text-sm font-medium text-zinc-700">
        <span className="tabular-nums">{students.toLocaleString("en-IN")}</span> students
      </p>
    </div>
  );
}

function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const reduceMotion = useReducedMotion();

  return (
    <div className="mx-auto mt-12 max-w-3xl divide-y divide-zinc-200 rounded-3xl border border-zinc-200/90 bg-white shadow-sm">
      {faqItems.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="px-5 sm:px-7">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full items-start justify-between gap-4 py-5 text-left transition hover:text-primary-800 sm:py-6"
            >
              <span className="font-[family-name:var(--font-landing-display)] text-base font-semibold text-zinc-900 sm:text-lg">
                {item.q}
              </span>
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                  isOpen
                    ? "border-primary-200 bg-primary-50 text-primary-700"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500"
                }`}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="pb-6 text-sm leading-relaxed text-zinc-600 sm:text-base">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function HeroPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto mt-14 w-full max-w-5xl px-4 sm:mt-16 sm:px-6 lg:mt-20 lg:px-8"
    >
      <div className="pointer-events-none absolute -inset-x-10 -top-8 h-40 bg-gradient-to-b from-primary-200/40 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/90 shadow-2xl shadow-primary-900/10 ring-1 ring-zinc-900/5 backdrop-blur sm:rounded-[1.75rem]">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/90 px-5 py-3.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <p className="truncate text-xs font-medium text-zinc-500">
            <span className="font-mono text-zinc-400">riverside</span>
            <span className="text-zinc-300"> · </span>
            institute dashboard
          </p>
          <Bell className="h-4 w-4 text-zinc-400" aria-hidden />
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-[1.1fr_0.9fr] sm:gap-6 sm:p-7">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-zinc-500">Good morning</p>
              <p className="mt-1 font-[family-name:var(--font-landing-display)] text-xl font-semibold text-zinc-900 sm:text-2xl">
                Riverside International School
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4"
              >
                <p className="text-xs font-medium text-zinc-500">Present today</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">94%</p>
                <p className="mt-1 text-xs text-emerald-600">+2% vs last week</p>
              </motion.div>
              <motion.div
                animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
                transition={{ duration: 5, delay: 0.4, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4"
              >
                <p className="text-xs font-medium text-zinc-500">Fees cleared</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">128</p>
                <p className="mt-1 text-xs text-zinc-500">This month</p>
              </motion.div>
            </div>
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-gradient-to-br from-white to-primary-50/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                  <Mail className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Fee reminder sent</p>
                  <p className="text-xs text-zinc-500">Grade 10 families · Scheduled send</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-zinc-100 bg-gradient-to-br from-primary-50/80 via-white to-emerald-50/50 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                Today’s focus
              </p>
              <ul className="mt-4 space-y-3 text-sm text-zinc-700">
                {[
                  "3 classes need attendance confirmation",
                  "Fee plan renewals for Grade 8",
                  "Exam window opens Monday",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-xs text-zinc-500">
                <span>Term readiness</span>
                <span className="font-semibold text-primary-700">82%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-zinc-100">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700"
                  initial={{ width: 0 }}
                  animate={{ width: "82%" }}
                  transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          </div>
        </div>
        <p className="border-t border-zinc-100 px-5 py-3 text-center text-xs text-zinc-400">
          Illustrative preview — each institute’s data and branding stay separate
        </p>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const ids = ["about", "how-it-works", "features", "pricing", "faq"];
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-35% 0px -50% 0px", threshold: [0.1, 0.25, 0.5] }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const navClass = (href) => {
    const id = href.startsWith("#") ? href.slice(1) : "";
    const active = id && activeSection === id;
    return `rounded-full px-3 py-2 text-sm font-medium transition xl:px-4 ${
      active
        ? "bg-primary-50 text-primary-900"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    }`;
  };

  return (
    <div
      className={`${outfit.variable} ${manrope.variable} min-h-dvh bg-[#f4f7f5] ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)] font-[family-name:var(--font-landing-body)] text-zinc-900 antialiased`}
    >
      <motion.div
        className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-primary-500 via-primary-600 to-emerald-600"
        style={{ scaleX }}
        aria-hidden
      />

      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(1000px 520px at 50% -8%, rgba(136, 179, 138, 0.22), transparent 55%), radial-gradient(700px 380px at 0% 40%, rgba(109, 163, 113, 0.08), transparent 50%), radial-gradient(600px 320px at 100% 30%, rgba(77, 124, 120, 0.07), transparent 45%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236FA371' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/55">
        <div className="mx-auto flex min-h-[3.5rem] max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:min-h-[4.25rem] sm:gap-4 sm:px-6 sm:py-0 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2.5"
            onClick={() => setMobileNavOpen(false)}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-800 shadow-md shadow-primary-500/25 ring-4 ring-white">
              <School className="h-5 w-5 text-white" aria-hidden />
            </span>
            <div className="min-w-0 leading-tight">
              <span className="block truncate font-[family-name:var(--font-landing-display)] text-sm font-semibold tracking-tight text-zinc-900 sm:text-base">
                mAI-school
              </span>
              <span className="hidden text-xs font-medium text-zinc-500 xs:block">
                School management
              </span>
            </div>
          </Link>
          <nav
            className="hidden items-center gap-0.5 rounded-full border border-zinc-200/80 bg-white/90 p-1 shadow-sm lg:flex"
            aria-label="Primary"
          >
            {LANDING_NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className={navClass(href)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex lg:gap-3">
            <Link
              href="/login"
              className="rounded-full px-3 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 lg:px-4"
              title="MAI platform administrators only"
            >
              Platform sign in
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/15 transition hover:bg-zinc-800"
            >
              Start online
              <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <Link
              href="/onboarding"
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full bg-zinc-900 px-3 text-xs font-semibold text-white shadow-md xs:px-4 xs:text-sm"
            >
              Start
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              aria-expanded={mobileNavOpen}
              aria-controls="landing-mobile-nav"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {mobileNavOpen && (
            <motion.div
              key="mobile-nav"
              id="landing-mobile-nav"
              role="navigation"
              aria-label="Mobile primary"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-zinc-200/80 bg-white/95 lg:hidden"
            >
              <div className="max-h-[min(32rem,calc(100dvh-5rem))] space-y-0.5 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
                {LANDING_NAV_LINKS.map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    className="flex min-h-[48px] items-center rounded-xl px-4 text-base font-medium text-zinc-800 transition hover:bg-zinc-100"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {label}
                  </a>
                ))}
                <div className="my-2 border-t border-zinc-100" aria-hidden />
                <Link
                  href="/login"
                  className="flex min-h-[48px] items-center rounded-xl px-4 text-base font-semibold text-zinc-700 transition hover:bg-zinc-100"
                  onClick={() => setMobileNavOpen(false)}
                >
                  Platform sign in
                </Link>
                <a
                  href="mailto:?subject=mAI-school%20%E2%80%94%20Talk%20to%20sales"
                  className="flex min-h-[48px] items-center rounded-xl px-4 text-base font-semibold text-primary-800 transition hover:bg-primary-50"
                  onClick={() => setMobileNavOpen(false)}
                >
                  Contact sales
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero — one composition */}
      <section className="relative overflow-hidden border-b border-zinc-200/60">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#eef6ef_0%,#f4f7f5_45%,#ffffff_100%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-4 pt-16 text-center sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="font-[family-name:var(--font-landing-display)] text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl"
          >
            mAI-school
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mx-auto mt-5 max-w-3xl font-[family-name:var(--font-landing-display)] text-2xl font-medium leading-snug tracking-tight text-zinc-800 sm:text-3xl lg:text-4xl lg:leading-[1.2]"
          >
            The calm, modern way to run your institute
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg"
          >
            Attendance, fees, exams, and campus communication—each school on its own subdomain,
            with data that stays yours.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/onboarding"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-600 px-8 text-base font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 sm:w-auto"
            >
              Start online
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <a
              href="mailto:?subject=mAI-school%20%E2%80%94%20Talk%20to%20sales"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-300 bg-white/80 px-8 text-base font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-white sm:w-auto"
            >
              Talk to sales
            </a>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mx-auto mt-4 max-w-md text-sm text-zinc-500"
          >
            School staff & students: use the sign-in link your institute shared—not this page.
          </motion.p>
        </div>
        <HeroPreview />
        <div className="h-10 sm:h-14" />
      </section>

      {/* About / product */}
      <section id="about" className="scroll-mt-24 border-b border-zinc-200/80 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="The product"
            title="One platform. Many schools. Zero shared chaos."
            description="mAI-school is built for institutes that want modern operations without losing their identity—your URL, your branding, your data."
          />
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {[
              {
                icon: Globe,
                title: "Multi-tenant by design",
                text: "Every institute is a tenant with a dedicated subdomain and isolated data. MAI runs platform ops from the apex; campuses live on their own hosts.",
              },
              {
                icon: Users,
                title: "Role-shaped experiences",
                text: "Admins configure, principals oversee, teachers teach, students stay informed—each with a focused home instead of a one-size dashboard.",
              },
              {
                icon: Sparkles,
                title: "AI that lightens admin load",
                text: "Drafting and summarizing assists help staff move faster on everyday writing—so energy stays with students, not busywork.",
              },
            ].map((block, i) => (
              <motion.article
                key={block.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="rounded-3xl border border-zinc-200/90 bg-[#f7faf8] p-7 transition hover:border-primary-200 hover:bg-white hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-sm ring-1 ring-zinc-100">
                  <block.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-[family-name:var(--font-landing-display)] text-lg font-semibold text-zinc-900">
                  {block.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{block.text}</p>
              </motion.article>
            ))}
          </div>

          <AudienceTabs />
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-24 border-b border-zinc-200/80 bg-[#f4f7f5] py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How it works"
            title="From signup to a campus that feels at home"
            description="Self-serve in minutes, or sales-led when you want a guided contract and kickoff. Same product underneath."
          />
          <HowItWorksInteractive />
          <motion.p {...fadeUp} className="mx-auto mt-14 max-w-2xl text-center text-sm text-zinc-500">
            Questions before step one?{" "}
            <a
              href="mailto:?subject=mAI-school%20%E2%80%94%20Question%20before%20signup"
              className="font-semibold text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-800"
            >
              Email us
            </a>{" "}
            — we typically reply within one business day.
          </motion.p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 border-b border-zinc-200/80 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Inside the product"
            title="Less admin drag. More time for learning."
            description="The outcomes schools feel first—not a spec sheet, just what your team uses every day."
          />
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {productFeatures.map((f, i) => (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.45, delay: i * 0.03 }}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-[#f7faf8] p-6 shadow-sm transition hover:border-primary-200/80 hover:bg-white hover:shadow-md"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-100/50 opacity-0 transition group-hover:opacity-100" />
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm ring-1 ring-zinc-100">
                  <f.icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="relative mt-5 font-[family-name:var(--font-landing-display)] text-base font-semibold text-zinc-900">
                  {f.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-zinc-600">{f.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-b border-zinc-200/80 bg-gradient-to-b from-[#f4f7f5] to-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trustPoints.map((block, i) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                  <block.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-zinc-900">{block.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{block.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-24 border-b border-zinc-200/80 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple student-based pricing"
            description="Self-serve at a clear per-student rate, or talk to sales for a guided commercial and rollout plan."
          />

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-2">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`relative flex flex-col rounded-3xl border p-8 ${
                  plan.featured
                    ? "border-primary-500/40 bg-gradient-to-b from-primary-50/90 to-white shadow-lg shadow-primary-900/5 ring-1 ring-primary-500/20"
                    : "border-zinc-200 bg-zinc-50/40"
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    plan.featured ? "text-primary-800" : "text-zinc-500"
                  }`}
                >
                  {plan.badge}
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-landing-display)] text-2xl font-semibold text-zinc-900">
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-[family-name:var(--font-landing-display)] text-4xl font-semibold text-zinc-900">
                    {plan.priceLabel}
                  </span>
                  <span className="text-sm text-zinc-500">{plan.priceSuffix}</span>
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-zinc-600">{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex gap-3 text-sm text-zinc-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" strokeWidth={2.5} />
                      {h}
                    </li>
                  ))}
                </ul>
                {plan.cta.external ? (
                  <a
                    href={plan.cta.href}
                    className="mt-8 inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                  >
                    {plan.cta.label}
                  </a>
                ) : (
                  <Link
                    href={plan.cta.href}
                    className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-primary-600 px-5 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    {plan.cta.label}
                  </Link>
                )}
              </motion.div>
            ))}
          </div>

          <PricingEstimator />

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-zinc-500">
            Roadmap: in-app billing, invoices, and automated payments. Dates vary by market—your
            sales contact can share the latest.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 border-b border-zinc-200/80 bg-[#f4f7f5] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="FAQ"
            title="Answers before you commit"
            description="Everything institutes usually ask before starting online or booking a sales call."
          />
          <div className="mt-2 flex justify-center">
            <HelpCircle className="h-5 w-5 text-primary-600/70" aria-hidden />
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-zinc-900 py-20 sm:py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(600px 300px at 20% 0%, rgba(136,179,138,0.35), transparent), radial-gradient(500px 280px at 90% 100%, rgba(77,124,120,0.25), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div {...fadeUp}>
            <h2 className="font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Bring mAI-school to your institute
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-zinc-400">
              Spin up your tenant online, or start with a conversation—we provision subdomain,
              login, and first admin so your team can focus on students.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/onboarding"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100 sm:w-auto"
              >
                Start online
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <a
                href="mailto:?subject=mAI-school%20%E2%80%94%20Get%20started"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-600 px-8 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
              >
                Contact sales
              </a>
            </div>
            <p className="mx-auto mt-4 max-w-md text-xs text-zinc-500">
              Institute staff and students: use your school’s sign-in link—not platform admin.
            </p>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600">
                  <School className="h-4 w-4 text-white" aria-hidden />
                </span>
                <span className="font-[family-name:var(--font-landing-display)] font-semibold text-zinc-900">
                  mAI-school
                </span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
                School management for modern institutes—calm operations, connected campuses, your
                brand on the door.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Product</p>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-600">
                <li>
                  <a href="#about" className="hover:text-zinc-900">
                    About
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-zinc-900">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-zinc-900">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-zinc-900">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Get started</p>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-600">
                <li>
                  <Link href="/onboarding" className="hover:text-zinc-900">
                    Start online
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:?subject=mAI-school%20%E2%80%94%20Talk%20to%20sales"
                    className="hover:text-zinc-900"
                  >
                    Contact sales
                  </a>
                </li>
                <li>
                  <Link href="/login" className="hover:text-zinc-900" title="Platform admins only">
                    Platform sign in
                  </Link>
                </li>
                <li>
                  <a href="#faq" className="hover:text-zinc-900">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Contact</p>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-600">
                <li>
                  <a
                    href="mailto:?subject=mAI-school%20%E2%80%94%20Hello"
                    className="inline-flex items-center gap-2 hover:text-zinc-900"
                  >
                    <Mail className="h-4 w-4 text-primary-600" />
                    Email the team
                  </a>
                </li>
                <li className="text-zinc-500">
                  For campus access, use the subdomain URL your institute shared with you.
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-100 pt-8 sm:flex-row">
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} mAI-school. All rights reserved.
            </p>
            <p className="text-sm text-zinc-400">Less admin drag. More time for learning.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
