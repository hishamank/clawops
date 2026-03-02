export const metadata = {
  title: "ClawOps",
  description: "Operations layer for AI agent teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
