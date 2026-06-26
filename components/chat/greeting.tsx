"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

const SUGGESTED_PROMPTS = [
  {
    icon: "💡",
    title: "解释概念",
    prompt: "用通俗易懂的语言解释什么是 React Server Components",
  },
  {
    icon: "✍️",
    title: "撰写文案",
    prompt: "帮我写一封正式的商务邮件，主题是项目进度汇报",
  },
  {
    icon: "🔧",
    title: "编写代码",
    prompt: "用 TypeScript 实现一个防抖函数，并添加类型注解",
  },
  {
    icon: "📊",
    title: "分析问题",
    prompt: "对比 REST API 和 GraphQL 的优缺点",
  },
];

export const Greeting = ({
  onSelectPrompt,
}: {
  onSelectPrompt?: (prompt: string) => void;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center px-4" key="overview">
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="mb-5 flex size-14 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-primary/10"
        initial={{ opacity: 0, scale: 0.8 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          alt="OPC Bot"
          className="size-full object-cover"
          height={56}
          src="/logo.jpg"
          width={56}
        />
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center font-semibold text-2xl tracking-tight text-foreground md:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        有什么我可以帮你的？
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 text-center text-muted-foreground/80 text-sm"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.45, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        提出问题、编写代码或探索想法。
      </motion.div>

      {/* 示例提示词：引导新用户快速上手 */}
      {onSelectPrompt && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-2.5"
          initial={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {SUGGESTED_PROMPTS.map((suggestion, index) => (
            <button
              aria-label={`使用示例：${suggestion.title}`}
              className="group flex flex-col gap-1 rounded-xl border border-border/50 bg-background/50 p-3 text-left transition-all duration-200 hover:border-border hover:bg-muted/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              key={suggestion.title}
              onClick={() => onSelectPrompt(suggestion.prompt)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              type="button"
            >
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <span aria-hidden="true">{suggestion.icon}</span>
                {suggestion.title}
              </span>
              <span
                className={`line-clamp-1 text-[11px] transition-colors ${
                  hoveredIndex === index
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
                }`}
              >
                {suggestion.prompt}
              </span>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
};
