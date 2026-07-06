import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

export function Button({
  className = "",
  variant = "primary",
  children,
  ...props
}: ButtonProps) {
  let baseStyle = "inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  
  let variants = {
    primary: "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 active:scale-[0.98]",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 active:scale-[0.98]",
    outline: "border border-zinc-700 text-zinc-300 hover:bg-zinc-800/50 hover:text-white active:scale-[0.98]",
    ghost: "text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200"
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
