import fs from 'node:fs';
import path from 'node:path';
import './page.css';
import PageClient from './client';

export const metadata = {
  title: "Market data — Youth Investing Simulator",
  description: "Real closing prices and exchange rates, refreshed every night by itself.",
};

// The page's words and boxes live in body.html. Next.js reads them here, on the server.
export default function Page() {
  const html = fs.readFileSync(path.join(process.cwd(), 'app/markets/body.html'), 'utf8');
  return <PageClient html={html} />;
}
