import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { THEME_INIT_SCRIPT } from "@/lib/themeScript";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  // Pages set a short title ("Sign in", "Students"…) shown as "Sign in · mAI-school".
  title: {
    default: "mAI-school — School management for modern institutes",
    template: "%s · mAI-school",
  },
  applicationName: "mAI-school",
  description:
    "Attendance, fees, exams, and campus communication in one platform. Self-serve at ₹30/student/month or sales-led setup—each institute on its own subdomain with isolated data.",
};

/** Proper scaling and notch / home-indicator safe spacing on phones and tablets. */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e12" },
  ],
};

export default function RootLayout({ children }) {
  return (
    // The theme class is set by the head script before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${inter.className} min-h-dvh antialiased`}
      >
        {children}
        <Toaster
          position="top-center"
          containerStyle={{
            top: "max(0.75rem, env(safe-area-inset-top))",
          }}
          toastOptions={{
            className: "max-w-[min(100vw-1.5rem,24rem)] text-sm",
            style: {
              marginBottom: "env(safe-area-inset-bottom)",
              background: "rgb(var(--surface))",
              color: "var(--text-primary)",
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-lg)",
              borderRadius: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
