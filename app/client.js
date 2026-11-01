'use client';
// This part runs in the browser. It is the page's old <script>, started once the boxes are on screen.
import { useEffect } from 'react';

export default function PageClient({ html }) {
  useEffect(() => {
    (async () => {
      
      const { showDataDate } = await import('../lib/asof.js');
      showDataDate('/data/meta.json');
    })();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
