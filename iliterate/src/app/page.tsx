import Link from "next/link";
import { BookOpen } from "lucide-react";
import LanguageShowcase from "@/components/LanguageShowcase";
import ThemeToggle from "@/components/ThemeToggle";
import { BlurFade } from "@/components/BlurFade";
import { BlurText } from "@/components/BlurText";
import { EB_Garamond, DM_Sans } from "next/font/google";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export default function Home() {
  return (
    <div
      className={`${ebGaramond.variable} ${dmSans.variable} min-h-screen`}
      style={{ background: "#FAF7F0", color: "#091413" }}
    >
      <style>{`
        .lp-display { font-family: var(--font-display), 'Georgia', serif; }
        .lp-body    { font-family: var(--font-body), system-ui, sans-serif; }

        @keyframes lp-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }

        .lp-float-slow { animation: lp-float 14s ease-in-out infinite; }
        .lp-float-med  { animation: lp-float 11s 1.5s ease-in-out infinite; }
        .lp-float-fast { animation: lp-float 8.5s 0.8s ease-in-out infinite; }

        .lp-nav-link { position: relative; }
        .lp-nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px; left: 0;
          width: 0; height: 1px;
          background: #285A48;
          transition: width 0.3s ease;
        }
        .lp-nav-link:hover::after { width: 100%; }

        .lp-btn-green {
          background: #285A48; color: #FAF7F0;
          transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        .lp-btn-green:hover {
          background: #1C3F34;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(40,90,72,0.35);
        }
        .lp-btn-outline {
          border: 1.5px solid rgba(9,20,19,0.2); color: #091413;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .lp-btn-outline:hover { background: rgba(40,90,72,0.06); border-color: rgba(40,90,72,0.4); }

        .lp-btn-cream {
          background: #FAF7F0; color: #091413;
          transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        .lp-btn-cream:hover {
          background: #EDE9E0;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(250,247,240,0.3);
        }

        .lp-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          background: #FAF7F0;
          border: 1px solid rgba(9,20,19,0.08);
        }
        .lp-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 24px 48px rgba(9,20,19,0.09);
        }

        .lp-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(9,20,19,0.05);
          border: 1px solid rgba(9,20,19,0.08);
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 0.78rem;
          color: #5C4F3A;
        }

        .lp-char {
          transition: color 0.35s ease;
          cursor: default;
        }
        .lp-char:hover {
          color: rgba(64, 138, 113, 0.9) !important;
        }
      `}</style>

      {/* ─── Navigation ─────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 px-6 md:px-12 py-4 flex items-center justify-between"
        style={{
          borderBottom: "1px solid rgba(9,20,19,0.07)",
          background: "rgba(250,247,240,0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex size-9 items-center justify-center rounded-lg" style={{ background: "#285A48" }}>
          <BookOpen className="size-5 text-white" />
        </div>
        <div className="flex items-center gap-6 lp-body text-sm">
          <Link
            href="/login"
            className="lp-nav-link hidden sm:inline-block"
            style={{ color: "#5C4F3A" }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="lp-btn-green inline-flex items-center gap-2 rounded-full px-5 py-2.5 lp-body text-sm font-medium"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="relative px-6 md:px-12 overflow-hidden flex flex-col items-center justify-center"
        style={{ minHeight: "calc(100vh - 57px)" }}
      >
        {/* Decorative script characters */}
        {/* CJK */}
        <span
          aria-hidden="true"
          className="lp-float-slow lp-char select-none absolute top-10 right-6 md:right-20 lp-display font-light"
          style={{
            fontSize: "clamp(5rem,12vw,9rem)",
            color: "rgba(9,20,19,0.04)",
            lineHeight: 1,
          }}
        >
          文
        </span>
        <span
          aria-hidden="true"
          className="lp-float-med lp-char select-none absolute bottom-16 right-16 md:right-36 lp-display font-light"
          style={{
            fontSize: "clamp(3rem,8vw,6rem)",
            color: "rgba(40,90,72,0.05)",
            lineHeight: 1,
          }}
        >
          語
        </span>
        {/* Japanese */}
        <span
          aria-hidden="true"
          className="lp-float-fast lp-char select-none absolute top-28 left-2 md:left-6 lp-display font-light"
          style={{
            fontSize: "clamp(2rem,6vw,4rem)",
            color: "rgba(9,20,19,0.04)",
            lineHeight: 1,
          }}
        >
          あ
        </span>
        {/* Korean */}
        <span
          aria-hidden="true"
          className="lp-float-slow lp-char select-none absolute bottom-24 left-8 md:left-20 lp-display font-light"
          style={{
            fontSize: "clamp(4rem,9vw,7rem)",
            color: "rgba(40,90,72,0.04)",
            lineHeight: 1,
          }}
        >
          한
        </span>
        {/* Arabic */}
        <span
          aria-hidden="true"
          className="lp-float-med lp-char select-none absolute top-16 left-1/4 lp-display font-light"
          style={{
            fontSize: "clamp(3.5rem,9vw,7rem)",
            color: "rgba(9,20,19,0.035)",
            lineHeight: 1,
          }}
        >
          ع
        </span>
        {/* Devanagari (Hindi) */}
        <span
          aria-hidden="true"
          className="lp-float-fast lp-char select-none absolute bottom-32 right-1/4 lp-display font-light"
          style={{
            fontSize: "clamp(2.5rem,7vw,5rem)",
            color: "rgba(40,90,72,0.045)",
            lineHeight: 1,
          }}
        >
          अ
        </span>
        {/* Greek */}
        <span
          aria-hidden="true"
          className="lp-float-slow lp-char select-none absolute top-1/3 right-2 md:right-10 lp-display font-light"
          style={{
            fontSize: "clamp(2rem,5vw,3.5rem)",
            color: "rgba(9,20,19,0.035)",
            lineHeight: 1,
          }}
        >
          Ω
        </span>
        {/* Cyrillic (Russian) */}
        <span
          aria-hidden="true"
          className="lp-float-med lp-char select-none absolute top-1/2 left-3 md:left-14 lp-display font-light"
          style={{
            fontSize: "clamp(2.5rem,6vw,4.5rem)",
            color: "rgba(40,90,72,0.04)",
            lineHeight: 1,
          }}
        >
          Я
        </span>
        {/* Thai */}
        <span
          aria-hidden="true"
          className="lp-float-fast lp-char select-none absolute bottom-10 left-1/3 lp-display font-light"
          style={{
            fontSize: "clamp(2rem,5vw,3.5rem)",
            color: "rgba(9,20,19,0.04)",
            lineHeight: 1,
          }}
        >
          ก
        </span>
        {/* Hebrew */}
        <span
          aria-hidden="true"
          className="lp-float-slow lp-char select-none absolute top-8 left-1/2 lp-display font-light"
          style={{
            fontSize: "clamp(2.5rem,6vw,4rem)",
            color: "rgba(40,90,72,0.035)",
            lineHeight: 1,
          }}
        >
          א
        </span>
        {/* Georgian */}
        <span
          aria-hidden="true"
          className="lp-float-med lp-char select-none absolute top-2/3 right-1/4 lp-display font-light"
          style={{
            fontSize: "clamp(2rem,5vw,3.5rem)",
            color: "rgba(9,20,19,0.04)",
            lineHeight: 1,
          }}
        >
          ა
        </span>
        {/* Bengali */}
        <span
          aria-hidden="true"
          className="lp-float-fast lp-char select-none absolute top-20 right-1/3 lp-display font-light"
          style={{
            fontSize: "clamp(2.5rem,6vw,4rem)",
            color: "rgba(40,90,72,0.04)",
            lineHeight: 1,
          }}
        >
          ই
        </span>
        {/* Tamil */}
        <span
          aria-hidden="true"
          className="lp-float-slow lp-char select-none absolute bottom-40 right-8 md:right-24 lp-display font-light"
          style={{
            fontSize: "clamp(2rem,4.5vw,3rem)",
            color: "rgba(9,20,19,0.035)",
            lineHeight: 1,
          }}
        >
          ழ
        </span>
        {/* Ethiopic */}
        <span
          aria-hidden="true"
          className="lp-float-med lp-char select-none absolute top-44 left-1/3 lp-display font-light"
          style={{
            fontSize: "clamp(2rem,5vw,3.5rem)",
            color: "rgba(40,90,72,0.035)",
            lineHeight: 1,
          }}
        >
          ሀ
        </span>

        <div className="max-w-6xl mx-auto text-center">
          {/* Main headline */}
          <h1
            className="lp-display"
            style={{
              fontSize: "clamp(3rem, 8vw, 7rem)",
              lineHeight: 1,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "#091413",
            }}
          >
            <BlurText text="Read the " delay={0.05} />
            <BlurText
              text="world."
              delay={0.05 + 9 * 0.03}
              style={{ fontStyle: "italic", color: "#285A48" }}
            />
          </h1>

          {/* Tagline */}
          <p
            className="lp-body mt-3 mx-auto"
            style={{
              fontSize: "clamp(0.875rem, 1.5vw, 1rem)",
              color: "#5C4F3A",
              lineHeight: 1.6,
              maxWidth: "30rem",
            }}
          >
            <BlurText
              text="Read real content in any language. Tap to translate, save words, review with flashcards."
              by="word"
              delay={0.5}
              duration={0.3}
              stagger={0.04}
            />
          </p>

          {/* CTA buttons */}
          <BlurFade delay={0.21} duration={0.75}>
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            <Link
              href="/signup"
              className="lp-btn-green inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 lp-body font-medium"
              style={{ fontSize: "0.95rem" }}
            >
              Start Reading Free
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2.5 7.5h10M8.5 3.5l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              href="/login"
              className="lp-btn-outline inline-flex items-center gap-2 rounded-full px-7 py-3.5 lp-body font-medium"
              style={{ fontSize: "0.95rem" }}
            >
              Sign In
            </Link>
          </div>
          </BlurFade>
        </div>
      </section>

      {/* ─── Features (dark gray) ────────────────────────────────────────── */}
      <section
        className="px-6 md:px-12 py-16 md:py-24"
        style={{ background: "#0D1816" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 md:mb-16">
            <h2
              className="lp-display mt-3 font-light"
              style={{
                fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
                color: "#FAF7F0",
                lineHeight: 1.15,
              }}
            >
              Everything you need
              <br />
              <em
                style={{ fontStyle: "italic", color: "rgba(176,228,204,0.9)" }}
              >
                to truly learn.
              </em>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
            {[
              {
                num: "01",
                title: "Read Real Content",
                body: "Import articles, books, and news in your target language. Read what interests you — not scripted textbook exercises.",
              },
              {
                num: "02",
                title: "Instant Vocabulary",
                body: "Tap any word for an instant translation, audio pronunciation, and contextual examples. Save words to your deck in one tap.",
              },
              {
                num: "03",
                title: "Spaced Repetition",
                body: "Saved words become flashcards automatically, reviewed at optimal intervals via the SM-2 algorithm for lasting retention.",
              },
            ].map(({ num, title, body }) => (
              <div
                key={num}
                className="rounded-2xl p-7 md:p-8"
                style={{
                  background: "#132219",
                  border: "1px solid rgba(250,247,240,0.07)",
                }}
              >
                <div
                  className="lp-display font-light mb-6"
                  style={{
                    fontSize: "clamp(3rem, 6vw, 4.5rem)",
                    color: "rgba(250,247,240,0.07)",
                    lineHeight: 1,
                  }}
                >
                  {num}
                </div>
                <h3
                  className="lp-display font-medium mb-3"
                  style={{
                    fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)",
                    color: "#FAF7F0",
                  }}
                >
                  {title}
                </h3>
                <p
                  className="lp-body text-sm leading-relaxed"
                  style={{ color: "rgba(250,247,240,0.55)" }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Language Showcase (cream) ───────────────────────────────────── */}
      <LanguageShowcase />

      {/* ─── Why It Works (white) ────────────────────────────────────────── */}
      <section
        className="px-6 md:px-12 py-16 md:py-24"
        style={{ background: "#FAF7F0" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 md:mb-16">
            <h2
              className="lp-display font-light"
              style={{
                fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
                color: "#091413",
                lineHeight: 1.1,
              }}
            >
              Why it{" "}
              <em style={{ fontStyle: "italic", color: "#285A48" }}>works.</em>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-12">
            {[
              {
                num: "01",
                title: "Comprehensible input",
                body: "Research shows we acquire language when we understand real messages — not when we drill isolated rules. Reading authentic content at your level is the most direct path to fluency.",
              },
              {
                num: "02",
                title: "Context beats memorization",
                body: "Words encountered in real sentences are retained far longer than those drilled from a list. Every word you save in iLiterate comes with the sentence you found it in — so memory has something to hold onto.",
              },
              {
                num: "03",
                title: "Spaced repetition does the work",
                body: "The SM-2 algorithm schedules your reviews at the exact intervals science says will stick. You don't manage a deck — you just read, save words, and show up for short daily reviews.",
              },
              {
                num: "04",
                title: "Progress compounds",
                body: "Every article you read builds your vocabulary, which makes the next article easier. Unlike streaks and XP, reading fluency grows on itself — and iLiterate tracks every step of that growth.",
              },
            ].map(({ num, title, body }) => (
              <div key={num} className="flex gap-6">
                <div
                  className="lp-display font-light shrink-0"
                  style={{
                    fontSize: "1.1rem",
                    color: "rgba(9,20,19,0.15)",
                    lineHeight: 1.6,
                    width: "2rem",
                  }}
                >
                  {num}
                </div>
                <div>
                  <h3
                    className="lp-display font-medium mb-3"
                    style={{
                      fontSize: "clamp(1.3rem, 2.5vw, 1.6rem)",
                      color: "#091413",
                      lineHeight: 1.2,
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    className="lp-body text-sm leading-relaxed"
                    style={{ color: "rgba(9,20,19,0.5)" }}
                  >
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner (green) ──────────────────────────────────────────── */}
      <section
        className="px-8 md:px-16 py-16 md:py-24 text-center"
        style={{ background: "#0D1816" }}
      >
        <h2
          className="lp-display font-light"
          style={{
            fontSize: "clamp(3rem, 8vw, 6rem)",
            color: "#FAF7F0",
            lineHeight: 0.95,
          }}
        >
          Start{" "}
          <em style={{ fontStyle: "italic", color: "#408A71" }}>reading.</em>
          <br />
          Start{" "}
          <em style={{ fontStyle: "italic", color: "#408A71" }}>learning.</em>
        </h2>
        <p
          className="lp-body mt-6 mb-10 mx-auto"
          style={{
            color: "rgba(250,247,240,0.6)",
            maxWidth: "32rem",
            fontSize: "0.95rem",
            lineHeight: 1.75,
          }}
        >
          Join learners who read their way to fluency. No credit card required —
          just pick a language and begin.
        </p>
        <Link
          href="/signup"
          className="lp-btn-cream inline-flex items-center gap-2.5 rounded-full px-8 py-4 lp-body font-medium"
          style={{ fontSize: "0.95rem" }}
        >
          Create a Free Account
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 7.5h10M8.5 3.5l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </section>

      {/* ─── Footer (dark gray) ──────────────────────────────────────────── */}
      <footer
        className="px-6 md:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ background: "#285A48" }}
      >
        <div
          className="lp-display text-lg font-semibold"
          style={{ color: "#FAF7F0" }}
        >
          i<span style={{ color: "rgba(176,228,204,0.9)" }}>Literate</span>
        </div>
        <p
          className="lp-body text-xs"
          style={{ color: "rgba(250,247,240,0.55)" }}
        >
          © 2026 iLiterate. Read more, learn more.
        </p>
        <ThemeToggle />
      </footer>
    </div>
  );
}
