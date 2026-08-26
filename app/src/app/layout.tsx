export const metadata = {
  title: "Rosenthal & Kin",
  description: "Operator console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
