import * as React from "react";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Award, CheckCircle, AlertTriangle, ArrowRight, BookOpen, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface FeedbackData {
  strengths: string[];
  weaknesses: string[];
  recommendations: string;
}

interface MessageData {
  id: string;
  role: "User" | "Assistant";
  content: string;
  createdAt: string;
}

interface InterviewData {
  id: string;
  githubUrl: string;
  githubMetadata: any;
  status: string;
  score: number | null;
  feedback: FeedbackData | null;
  messages?: MessageData[];
}

export function Result() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InterviewData | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);

  useEffect(() => {
    let active = true;
    let timerId: any;

    async function fetchResult() {
      try {
        const res = await fetch(`/api/v1/result/${interviewId}`);
        if (!res.ok) throw new Error("Evaluation record not available.");
        const result: InterviewData = await res.json();

        if (active) {
          setData(result);
          // If status is Done and feedback is generated, we stop loading
          if (result.status === "Done" && result.score !== null) {
            setLoading(false);
          } else {
            // Keep polling every 3 seconds if backend is calculating
            setPollingAttempts((prev) => prev + 1);
            if (pollingAttempts < 20) {
              timerId = setTimeout(fetchResult, 3000);
            } else {
              setLoading(false);
              toast.error("Analysis timeout. Please try refreshing manually.");
            }
          }
        }
      } catch (err: any) {
        if (active) {
          console.error(err);
          setLoading(false);
          toast.error("Failed to retrieve assessment data.");
        }
      }
    }

    fetchResult();

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [interviewId, pollingAttempts]);

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto text-center space-y-6 py-12">
        <div className="relative w-24 h-24 mx-auto">
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-ping"></div>
          <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-100">Generating Evaluation</h2>
          <p className="text-sm text-zinc-400">
            Analyzing your repository profiles and live chat transcript with Google Gemini. This may take a moment...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full max-w-md mx-auto text-center space-y-4 py-12">
        <h2 className="text-xl font-bold text-rose-500">Record Not Found</h2>
        <p className="text-zinc-400">The requested interview assessment could not be retrieved.</p>
        <Link to="/" className="inline-block px-5 py-2.5 rounded-lg bg-zinc-800 text-white border border-zinc-700">
          Return to Home
        </Link>
      </div>
    );
  }

  const score = data.score || 0;
  const feedback = data.feedback || { strengths: [], weaknesses: [], recommendations: "" };
  const messages = data.messages || [];

  // Color mapping based on score
  const scoreColors = {
    high: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      track: "stroke-emerald-500",
    },
    medium: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      track: "stroke-amber-500",
    },
    low: {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      track: "stroke-rose-500",
    },
  };

  const currentTheme = score >= 8 ? scoreColors.high : score >= 5 ? scoreColors.medium : scoreColors.low;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col space-y-8 py-4">
      {/* Overview Dashboard Card */}
      <div className="glass-premium rounded-3xl p-6 md:p-8 shadow-2xl border border-zinc-800/60 relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Score Radial Indicator */}
        <div className="flex flex-col items-center justify-center text-center space-y-4 border-b md:border-b-0 md:border-r border-zinc-800/80 pb-6 md:pb-0 md:pr-8">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-zinc-800"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className={currentTheme.track}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * score) / 10}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{score}</span>
              <span className="text-xs uppercase font-bold text-zinc-500 tracking-wider">of 10</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-1.5 justify-center">
              <Award className="w-4 h-4 text-purple-400" />
              <span>Technical Score</span>
            </h3>
            <p className="text-xs text-zinc-400">Tailored against {data.githubMetadata?.username || "GitHub"} repositories</p>
          </div>
        </div>

        {/* Actionable Recommendations */}
        <div className="md:col-span-2 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="text-xs uppercase font-extrabold text-purple-400 tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Strategic Recommendation</span>
            </span>
            <h2 className="text-xl font-bold text-white">Actionable Steps for Growth</h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {feedback.recommendations || "Review fundamental schemas and architectural patterns in target languages."}
            </p>
          </div>
          
          <div className="flex gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-all shadow-lg shadow-purple-500/10 active:scale-95 cursor-pointer"
            >
              <span>Interview Another Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses Detailed Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Strengths Card */}
        <div className="glass-premium rounded-2xl p-6 border border-zinc-800/60 flex flex-col space-y-4">
          <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Key Strengths</span>
          </h3>
          <ul className="space-y-2.5">
            {feedback.strengths.map((str, i) => (
              <li key={i} className="text-sm text-zinc-300 flex items-start gap-2.5 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-2"></span>
                <span>{str}</span>
              </li>
            ))}
            {feedback.strengths.length === 0 && (
              <li className="text-sm text-zinc-500 italic">No structured strengths logged.</li>
            )}
          </ul>
        </div>

        {/* Weaknesses Card */}
        <div className="glass-premium rounded-2xl p-6 border border-zinc-800/60 flex flex-col space-y-4">
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Improvement Areas</span>
          </h3>
          <ul className="space-y-2.5">
            {feedback.weaknesses.map((weak, i) => (
              <li key={i} className="text-sm text-zinc-300 flex items-start gap-2.5 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-2"></span>
                <span>{weak}</span>
              </li>
            ))}
            {feedback.weaknesses.length === 0 && (
              <li className="text-sm text-zinc-500 italic">No structured weaknesses logged.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Transcript Log Card */}
      <div className="glass-premium rounded-2xl p-6 border border-zinc-800/60 flex flex-col space-y-6">
        <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2 border-b border-zinc-800/80 pb-3">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          <span>Interview Dialogue History</span>
        </h3>

        <div className="space-y-4 max-h-96 overflow-y-auto pr-2 flex flex-col">
          {messages.map((msg, i) => {
            const isUser = msg.role === "User";
            return (
              <div
                key={msg.id || i}
                className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                  isUser
                    ? "self-end bg-purple-600/10 border border-purple-500/20 text-purple-200 rounded-tr-none"
                    : "self-start bg-zinc-900 border border-zinc-800/60 text-zinc-300 rounded-tl-none"
                }`}
              >
                <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">
                  {isUser ? "Candidate" : "Interviewer AI"}
                </div>
                <div>{msg.content}</div>
              </div>
            );
          })}
          
          {messages.length === 0 && (
            <div className="text-center py-6 text-sm text-zinc-500 italic">
              No conversation dialogue history was saved for this session.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
