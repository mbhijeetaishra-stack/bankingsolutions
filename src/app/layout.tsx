import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/react';
import PwaAppExperience from "@/components/PwaAppExperience";
import { ThemeProvider } from '@/lib/theme';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'BankingSolutions – SBI, IBPS, RRB & Banking Exam Prep',
  description: 'BSPS Practice Sheets, BSCA Current Affairs, Real CBT Mock Tests, Smart Mistake Notebook & Daily GA Quizzes',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BankingSolutions',
  },
  icons: {
    icon: '/channel-logo.png',
    shortcut: '/channel-logo.png',
    apple: '/channel-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('bs_theme');
                  var theme = saved === 'light' ? 'light' : 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <PwaAppExperience />
          <Analytics />
          <script src="https://checkout.razorpay.com/v1/checkout.js" async />
        </ThemeProvider>
      </body>
    </html>
  );
}
