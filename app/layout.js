import "./globals.css";
import { settings } from "../lib/config.js";

export const metadata = {
  title: { default: settings.siteName, template: `%s · ${settings.siteName}` },
  description: settings.tagline,
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0f4c5c" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
