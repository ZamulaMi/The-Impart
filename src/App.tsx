/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Search } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen w-full bg-white text-black">
      <header className="w-full bg-white px-6 sm:px-12 md:px-16 py-6 sm:py-8 flex items-center justify-between">
        <span
          className="text-2xl sm:text-3xl font-medium tracking-tight text-black select-none"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          The Impart
        </span>
        <button
          type="button"
          aria-label="Пошук"
          className="p-2 text-black hover:opacity-60 transition-opacity cursor-pointer focus:outline-none"
        >
          <Search className="w-5 h-5 stroke-[1.75]" />
        </button>
      </header>
    </div>
  );
}
