import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wallify — Sprawdź zanim kupisz",
  description:
    "Podgląd AR obrazów na płótnie przez kamerę telefonu. Sprawdź, jak obraz będzie wyglądać na Twojej ścianie — w rzeczywistej skali, w czasie rzeczywistym.",
  openGraph: {
    title: "Wallify — Sprawdź zanim kupisz",
    description:
      "Podgląd AR obrazów na płótnie. Bez instalowania aplikacji.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-black text-white antialiased font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
