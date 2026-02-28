import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tameio",
  description: "The bank of tomorrow — powered by Monad",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Lava lamp — rendered on every page */}
        <div
          style={{
            pointerEvents: "none",
            position: "fixed",
            inset: 0,
            overflow: "hidden",
            zIndex: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "15%",
              left: "20%",
              width: 700,
              height: 700,
              borderRadius: "50%",
              background: "rgb(120, 10, 35)",
              filter: "blur(80px)",
              opacity: 0.55,
              animation: "lava-1 32s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "55%",
              left: "58%",
              width: 600,
              height: 600,
              borderRadius: "50%",
              background: "rgb(90, 5, 25)",
              filter: "blur(75px)",
              opacity: 0.5,
              animation: "lava-2 42s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "70%",
              left: "8%",
              width: 640,
              height: 640,
              borderRadius: "50%",
              background: "rgb(105, 8, 30)",
              filter: "blur(85px)",
              opacity: 0.45,
              animation: "lava-3 50s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "5%",
              left: "65%",
              width: 500,
              height: 500,
              borderRadius: "50%",
              background: "rgb(140, 15, 45)",
              filter: "blur(70px)",
              opacity: 0.5,
              animation: "lava-4 37s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "38%",
              left: "35%",
              width: 380,
              height: 380,
              borderRadius: "50%",
              background: "rgb(160, 20, 55)",
              filter: "blur(65px)",
              opacity: 0.4,
              animation: "lava-5 28s ease-in-out infinite",
            }}
          />
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
