import fs from 'node:fs';
import path from 'node:path';
import './page.css';
import PageClient from './client';

export const metadata = {
  title: "Time machine — Youth Investing Simulator",
  description: "What if you had invested back in 2016? Pick a mix and see what it would be worth today.",
};

// The page's words and boxes live in body.html. Next.js reads them here, on the server.
export default function Page() {
  const html = fs.readFileSync(path.join(process.cwd(), 'app/time-machine/body.html'), 'utf8');
  return <PageClient html={html} />;
}
