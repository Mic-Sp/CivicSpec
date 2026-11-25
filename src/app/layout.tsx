import type { Metadata } from "next";

import { themeInitializationScript } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "CivicSpec",
  description: "Real needs. Real code. Real experience.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
