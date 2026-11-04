import fs from 'node:fs';
import path from 'node:path';
import './page.css';
import PageClient from './client';

export const metadata = {
  title: "Youth Investing Simulator",
  description: "Learn compound interest, risk and diversification with pretend money on real market data.",
};

// The page's words and boxes live in body.html. Next.js reads them here, on the server.
export default function Page() {
  const html = fs.readFileSync(path.join(process.cwd(), 'app/body.html'), 'utf8');
  return <PageClient html={html} />;
}
