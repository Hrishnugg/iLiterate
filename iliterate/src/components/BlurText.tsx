"use client"

import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface BlurTextProps {
  text: string
  className?: string
  /** Split and animate by "character" or "word" */
  by?: "character" | "word"
  /** Delay before the first segment starts (seconds) */
  delay?: number
  /** Duration of each segment's animation (seconds) */
  duration?: number
  /** Gap between each segment starting (seconds) */
  stagger?: number
  style?: React.CSSProperties
}

const segmentVariants = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 10 },
  show: { opacity: 1, filter: "blur(0px)", y: 0 },
}

export function BlurText({
  text,
  className,
  by = "character",
  delay = 0,
  duration = 0.4,
  stagger,
  style,
}: BlurTextProps) {
  const defaultStagger = by === "word" ? 0.06 : 0.03
  const resolvedStagger = stagger ?? defaultStagger

  const segments =
    by === "word"
      ? text.split(" ").map((w, i, arr) => (i < arr.length - 1 ? w + " " : w))
      : text.split("")

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        delayChildren: delay,
        staggerChildren: resolvedStagger,
      },
    },
  }

  return (
    <motion.span
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={cn("inline whitespace-pre-wrap", className)}
      style={style}
      aria-label={text}
    >
      <span className="sr-only">{text}</span>
      {segments.map((seg, i) => (
        <motion.span
          key={i}
          variants={segmentVariants}
          transition={{ duration, ease: "easeOut" }}
          className="inline-block whitespace-pre"
          aria-hidden
        >
          {seg}
        </motion.span>
      ))}
    </motion.span>
  )
}
