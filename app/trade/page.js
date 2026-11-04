import fs from 'node:fs';
import path from 'node:path';
import './page.css';
import '../../tutorial.css';
import PageClient from './client';

export const metadata = {
  title: "Trade — Youth Investing Simulator",
  description: "Buy and sell real companies and index funds with 10,00,000 of pretend money.",
};

// The page's words and boxes live in body.html. Next.js reads them here, on the server.
export default function Page() {
  const html = fs.readFileSync(path.join(process.cwd(), 'app/trade/body.html'), 'utf8');
  return <PageClient html={html} />;
}
