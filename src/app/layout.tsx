import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "WAM | The Heart of Church Growth. Managed.",
    template: "%s | WAM",
  },
  description: "Church management: members, finances, events, attendance and pastoral care in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Toaster richColors position="top-right" />
        {children}
      </body>
    </html>
  );
}
