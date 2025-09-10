import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

// Optimized font loading with display swap for better performance
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"], // Reduced font weights for better performance
  display: "swap", // Critical for CLS optimization
  preload: true,
});

export const metadata: Metadata = {
  title: "Hughome CRM",
  description: "Customer relationship management for home services",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#dc2626', // Red theme color for PWA
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${notoSansThai.variable} font-sans overflow-hidden antialiased bg-gray-50`}
      >
        {children}
      </body>
    </html>
  );
}
