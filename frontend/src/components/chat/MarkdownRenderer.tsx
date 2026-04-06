"use client";

import { useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

function CodeBlock({ children, className, ...props }: { children?: ReactNode; className?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const text = ref.current?.innerText ?? "";
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative group my-3">
      <button
        type="button"
        onClick={copy}
        className={cn(
          "absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium",
          "bg-[#161b22] border border-white/10 text-zinc-300",
          "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity",
          "hover:bg-[#21262d] hover:text-white"
        )}
      >
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre
        ref={ref}
        className="rounded-xl overflow-x-auto text-sm bg-[#0d1117] p-4 pt-10 border border-white/5"
      >
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content, isStreaming, className }: Props) {
  return (
    <div className={cn("prose-rag-system", isStreaming && "streaming-cursor", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ node, className: cname, children, ...props }: any) => {
            const isBlock = Boolean(cname?.includes("language-"));
            if (isBlock) {
              return (
                <CodeBlock className={cname} {...props}>
                  {children}
                </CodeBlock>
              );
            }
            return (
              <code
                className="font-mono text-xs px-1.5 py-0.5 rounded bg-[rgb(var(--surface-2))] text-brand-500 dark:text-brand-400"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
