import * as React from "react";

export interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  code: string;
  language?: string;
}

export function Code({ code, language = "json", className = "", ...props }: CodeProps) {
  return (
    <pre className={`relative overflow-x-auto rounded-lg bg-zinc-950/80 p-4 border border-zinc-800 text-zinc-300 font-mono text-sm leading-relaxed ${className}`}>
      <code className={`language-${language}`} {...props}>
        {code}
      </code>
    </pre>
  );
}
