import type { Metadata } from "next";
import { Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/nav/AppSidebar";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const ibmMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dealdesk — Real Estate Deal Intelligence",
  description: "Analyze, structure, and close real estate deals smarter.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${schibsted.variable} ${ibmMono.variable} h-full`}
      >
        <body className="h-full">
          <div className="flex h-screen overflow-hidden">
            <AppSidebar />
            <main className="flex-1 min-w-0 h-full overflow-hidden">
              {children}
            </main>
          </div>
          <Toaster position="bottom-right" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
