import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const appUrl =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  process.env.BETTER_AUTH_URL ||
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`),
  title: {
    default: "World Ark Missions | The Heart of Church Growth. Managed.",
    template: "%s | World Ark Missions",
  },
  description: "Church management: members, finances, discipleship, and pastoral care in one place.",
  keywords: [
    "World Ark Missions",
    "church management",
    "member portal",
    "tithes tracker",
    "welfare dues",
    "pastoral care",
  ],
  icons: {
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    siteName: "World Ark Missions",
    title: "World Ark Missions | The Heart of Church Growth. Managed.",
    description: "Church management: members, finances, discipleship, and pastoral care in one place.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "World Ark Missions Church Logo",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dm5bp1efp/image/upload/v1792173363/churchy/branding/noka8l1kbu6jz0zuzrva.png",
        width: 512,
        height: 512,
        alt: "World Ark Missions Church Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "World Ark Missions | The Heart of Church Growth. Managed.",
    description: "Church management: members, finances, discipleship, and pastoral care in one place.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full font-sans overflow-x-hidden">
        <Toaster richColors position="top-right" />
        {children}
      </body>
    </html>
  );
}
