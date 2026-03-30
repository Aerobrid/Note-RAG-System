"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function MarkdownRenderer({ content, isStreaming, className }: Props) {
  return (
    <div className={cn("prose-rag-system", isStreaming && "streaming-cursor", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children, ...props }) => (
            <pre {...props} className="rounded-xl overflow-x-auto my-3 text-sm bg-[#0d1117] p-4">
              {children}
            </pre>
          ),
          code: ({ node, className, children, ...props }: any) => {
            const isBlock = className?.includes("language-");
            if (isBlock) return <code className={className} {...props}>{children}</code>;
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
