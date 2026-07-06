import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Github, Play, Loader2, ArrowRight } from "lucide-react";

export function Form() {
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Simple url validation
    if (!githubUrl.trim()) {
      setError("GitHub profile URL is required");
      return;
    }

    if (!githubUrl.toLowerCase().includes("github.com")) {
      setError("Please provide a valid GitHub profile URL (e.g., https://github.com/username)");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/v1/pre-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to initialize interview");
      }

      const interview = await response.json();
      navigate(`/interview/${interview.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please check the backend connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto py-8">
      {/* Visual background blob */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>

      <div className="glass-premium rounded-3xl p-8 md:p-10 shadow-2xl relative border border-zinc-800/60 overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>

        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Github className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Technical Assessment
          </h1>
          <p className="text-sm text-zinc-400 max-w-sm">
            Input your GitHub profile URL below. Our AI interviewer will analyze your repositories to tailor the interview topics to your stack.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="github-url" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
              GitHub Profile Link
            </label>
            <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/60 focus-within:ring-2 focus-within:ring-purple-500/50 transition-all">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Github className="w-5 h-5" />
              </div>
              <input
                id="github-url"
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username"
                disabled={loading}
                className="w-full bg-transparent pl-11 pr-4 py-3.5 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none rounded-xl"
              />
            </div>
            {error && (
              <p className="text-xs text-rose-500 font-medium pl-1">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-semibold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-500/10 transition-all hover:-translate-y-[1px] active:translate-y-0 cursor-pointer disabled:opacity-50 disabled:pointer-events-none group"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing repositories...</span>
              </>
            ) : (
              <>
                <span>Begin Live Interview</span>
                <Play className="w-4 h-4 fill-current group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
