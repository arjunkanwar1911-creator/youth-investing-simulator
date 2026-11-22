import fs from 'node:fs';
import path from 'node:path';
import '../time-machine/page.css';
import './page.css';
import PageClient from './client';

export const metadata = {
  title: "Weekly challenge — Youth Investing Simulator",
  description: "Same rough patch for everyone, new one every Monday. Can you lose less than the market?",
};

// The page's words and boxes live in body.html. Next.js reads them here, on the server.
export default function Page() {
  const html = fs.readFileSync(path.join(process.cwd(), 'app/challenge/body.html'), 'utf8');
  return <PageClient html={html} />;
}
