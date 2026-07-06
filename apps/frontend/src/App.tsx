import * as React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Form } from "./components/Form";
import { Interview } from "./components/Interview";
import { Result } from "./components/Result";
import { Terminal, Cpu } from "lucide-react";

export function App() {
  return (
    <BrowserRouter>
      {/* Header bar */}
      <header className="glass border-b border-zinc-800/80 sticky top-0 z-50 py-4 px-6 md:px-12 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <span className="font-semibold text-lg bg-gradient-to-r from-purple-300 to-indigo-200 bg-clip-text text-transparent tracking-wide">
            FastInterview
          </span>
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>System active</span>
        </div>
      </header>

      {/* Pages Container */}
      <main className="flex-grow flex items-center justify-center p-6 md:p-12 max-w-7xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<Form />} />
          <Route path="/interview/:interviewId" element={<Interview />} />
          <Route path="/result/:interviewId" element={<Result />} />
        </Routes>
      </main>

      {/* Footer bar */}
      <footer className="py-6 border-t border-zinc-900 text-center text-xs text-zinc-600 flex flex-col sm:flex-row justify-between items-center px-12 gap-2">
        <div>
          &copy; {new Date().getFullYear()} FastInterview. Created by Muhammad Maaz. All rights reserved.
        </div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-zinc-400 transition-colors">Privacy</a>
          <a href="#" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
        </div>
      </footer>
    </BrowserRouter>
  );
}
