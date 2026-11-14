// The frame around every page. Next.js puts each page's content where {children} is.
import './auth-bar.css';
import AuthBar from './auth-bar';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthBar />
        {children}
      </body>
    </html>
  );
}
