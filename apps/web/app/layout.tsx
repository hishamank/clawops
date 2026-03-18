import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SidebarWrapper } from "@/components/sidebar-wrapper";
import { BreadcrumbBar } from "@/components/breadcrumb-bar";
import { ClientProviders } from "@/components/client-providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ClawOps",
  description: "Operations layer for AI agent teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ClientProviders>
          <div className="flex h-screen overflow-hidden">
            <SidebarWrapper />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <BreadcrumbBar />
              <main className="flex-1 overflow-y-auto p-6">
                {children}
              </main>
            </div>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
