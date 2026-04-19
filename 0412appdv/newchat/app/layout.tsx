import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";

const THEME_STORAGE_KEY = "talkbridge-theme";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "JustTalk",
  description: "Just talk, in your language."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="theme-soft" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
                  var theme =
                    storedTheme === "theme-dark" ||
                    storedTheme === "theme-soft" ||
                    storedTheme === "theme-light" ||
                    storedTheme === "theme-classic"
                    ? storedTheme
                    : "theme-soft";
                  document.documentElement.className = theme;
                } catch (error) {
                  document.documentElement.className = "theme-soft";
                }
              })();
            `
          }}
        />
      </head>
      <body
        className={`${manrope.variable} ${playfair.variable} min-h-screen bg-[rgb(var(--bg))] font-[family-name:var(--font-sans)] text-[rgb(var(--text))] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
