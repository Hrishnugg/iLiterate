"use client"

import { useRef } from "react"
import {
  AnimatePresence,
  motion,
  useInView,
  type Variants,
} from "motion/react"

interface BlurFadeProps {
  children: React.ReactNode
  className?: string
  duration?: number
  delay?: number
  offset?: number
  blur?: string
  inView?: boolean
}

export function BlurFade({
  children,
  className,
  duration = 0.75,
  delay = 0,
  offset = 28,
  blur = "12px",
  inView = false,
}: BlurFadeProps) {
  const ref = useRef(null)
  const inViewResult = useInView(ref, { once: true, margin: "-50px" })
  const isInView = !inView || inViewResult

  const variants: Variants = {
    hidden: { y: offset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: 0, opacity: 1, filter: "blur(0px)" },
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={variants}
        transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
