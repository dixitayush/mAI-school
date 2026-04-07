import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "mAI-school — School management for modern institutes",
  description:
    "Run attendance, fees, exams, and communication in one place. Self-serve institute onboarding or sales-led setup; multi-tenant subdomains with student-based pricing in INR.",
};

/** Proper scaling and notch / home-indicator safe spacing on phones and tablets. */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f4f4f5",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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
            },
          }}
        />
      </body>
    </html>
  );
}
