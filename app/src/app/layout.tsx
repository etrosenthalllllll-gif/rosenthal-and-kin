export const metadata = {
  title: "Rosenthal & Kin",
  description: "Operator console",
};

// Brand system shared by every /ops and /login page -- matches the
// approved Decision Dashboard / Client Portal mockups (navy/gold/
// parchment, Playfair Display + Inter + IBM Plex Mono). Defined once
// here as CSS variables so every page's inline styles can reference
// var(--navy) etc. rather than repeating hex codes.
const BRAND_STYLE = `
  :root {
    --cream: #ede3cb;
    --cream2: #f7f2e4;
    --navy: #1c2b45;
    --navy2: #16213a;
    --line: #cfc19b;
    --line-soft: #e2d7b8;
    --gold: #a97d43;
    --gold-soft: #cfa16a;
    --text: #1c2b45;
    --dim: #5c6478;
    --mono: #8a8368;
    --green: #55744a;
    --green-bg: #e3e6d2;
    --rust: #8c3a2b;
    --rust-bg: #ecdbd2;
    --amber: #93672c;
    --amber-bg: #f1e2c2;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--cream);
    color: var(--text);
    font-family: "Inter", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  input, textarea, button { font-family: inherit; }
  button { -webkit-tap-highlight-color: transparent; }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line react/no-danger */}
        <style dangerouslySetInnerHTML={{ __html: BRAND_STYLE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
