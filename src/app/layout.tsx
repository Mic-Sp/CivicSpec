import type { Metadata } from "next";

import { themeInitializationScript } from "@/lib/theme";
import { ThemeProvider } from "@/components/ThemeProvider";
import { workspaceService } from "@/server/workspace/request";

import "./globals.css";

export const metadata: Metadata = {
  title: "CivicSpec",
  description: "Real needs. Real code. Real experience.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const workspace = await workspaceService.read();
  return (
    <html lang="en" data-theme={workspace?.theme ?? "system"} data-theme-source={workspace ? "account" : "local"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="min-h-dvh"><ThemeProvider key={workspace?.user.id ?? "visitor"} accountId={workspace?.user.id ?? null} accountTheme={workspace?.theme ?? null}>{children}</ThemeProvider></body>
    </html>
  );
}
