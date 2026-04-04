import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "mAI-school — School management for modern institutes",
  description:
    "Run attendance, fees, exams, and communication in one place. Sales-led onboarding with dedicated setup; roadmap includes self-serve and student-based pricing.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
