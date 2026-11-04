// The frame around every page. Next.js puts each page's content where {children} is.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
