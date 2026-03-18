"use client";

import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";

/* ── Data ─────────────────────────────────────────────────────────────────── */
const LANG_FLAGS = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "ru", name: "Russian" },
  { code: "pl", name: "Polish" },
  { code: "se", name: "Swedish" },
  { code: "no", name: "Norwegian" },
  { code: "dk", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "gr", name: "Greek" },
  { code: "ro", name: "Romanian" },
  { code: "ua", name: "Ukrainian" },
  { code: "cz", name: "Czech" },
  { code: "jp", name: "Japanese" },
  { code: "cn", name: "Mandarin" },
  { code: "kr", name: "Korean" },
  { code: "in", name: "Hindi" },
  { code: "bd", name: "Bengali" },
  { code: "th", name: "Thai" },
  { code: "vn", name: "Vietnamese" },
  { code: "id", name: "Indonesian" },
  { code: "ph", name: "Filipino" },
  { code: "my", name: "Malay" },
  { code: "hk", name: "Cantonese" },
  { code: "sa", name: "Arabic" },
  { code: "ir", name: "Persian" },
  { code: "il", name: "Hebrew" },
  { code: "tr", name: "Turkish" },
  { code: "pk", name: "Urdu" },
  { code: "ke", name: "Swahili" },
  { code: "et", name: "Amharic" },
  { code: "ng", name: "Yoruba" },
  { code: "za", name: "Zulu" },
  { code: "mx", name: "Nahuatl" },
  { code: "py", name: "Guaraní" },
  { code: "pe", name: "Quechua" },
  { code: "br", name: "Portuguese (BR)" },
  { code: "eg", name: "Arabic (EG)" },
];

/* ── Types ───────────────────────────────────────────────────────────────── */
interface FlagItem {
  id: number;
  x: number;
  y: number;
  code: string;
  rotation: number;
  size: number;
}

/* ── Config ──────────────────────────────────────────────────────────────── */
const MIN_DIST  = 48;
const MAX_TRAIL = 20;
const LIFETIME  = 1300;

/* ── Flag subcomponent ───────────────────────────────────────────────────── */
function TrailFlag({ flag }: { flag: FlagItem }) {
  return (
    <motion.img
      src={`https://flagcdn.com/w80/${flag.code}.png`}
      alt={flag.code}
      draggable={false}
      initial={{ opacity: 0, scale: 0.25, rotate: flag.rotation * 2 }}
      animate={{ opacity: 1,  scale: 1,    rotate: flag.rotation }}
      exit={{    opacity: 0,  scale: 0.55, y: -18,
        transition: { duration: 0.45, ease: "easeIn" } }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{
        position:      "absolute",
        left:          flag.x - flag.size / 2,
        top:           flag.y - flag.size * 0.37,
        width:         flag.size,
        borderRadius:  4,
        boxShadow:     "0 4px 14px rgba(0,0,0,0.18)",
        pointerEvents: "none",
        userSelect:    "none",
        zIndex:        2,
      }}
    />
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function LanguageShowcase() {
  const sectionRef   = useRef<HTMLElement>(null);
  const lastPos      = useRef({ x: -9999, y: -9999 });
  const idRef        = useRef(0);
  const recentCodes  = useRef<string[]>([]);

  const [trail,       setTrail]       = useState<FlagItem[]>([]);
  const [isInside,    setIsInside]    = useState(false);
  const [currentLang, setCurrentLang] = useState<string | null>(null);

  const nextCode = () => {
    const pool = LANG_FLAGS.filter(l => !recentCodes.current.slice(-8).includes(l.code));
    const { code } = pool[Math.floor(Math.random() * pool.length)];
    recentCodes.current = [...recentCodes.current.slice(-12), code];
    return code;
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - lastPos.current.x;
    const dy = y - lastPos.current.y;
    if (Math.sqrt(dx * dx + dy * dy) < MIN_DIST) return;
    lastPos.current = { x, y };

    const id       = ++idRef.current;
    const code     = nextCode();
    const rotation = (Math.random() - 0.5) * 28;
    const size     = 46 + Math.random() * 18;
    const name     = LANG_FLAGS.find(l => l.code === code)?.name ?? code;

    setCurrentLang(name);
    setTrail(prev => [...prev.slice(-(MAX_TRAIL - 1)), { id, x, y, code, rotation, size }]);

    setTimeout(() => {
      setTrail(prev => prev.filter(f => f.id !== id));
    }, LIFETIME);
  }, []);

  const handleEnter = () => setIsInside(true);
  const handleLeave = () => {
    setIsInside(false);
    setTrail([]);
    setCurrentLang(null);
    lastPos.current = { x: -9999, y: -9999 };
  };

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        position:   "relative",
        overflow:   "hidden",
        background: "#2E5D3B",
        cursor:     isInside ? "none" : "default",
        padding:    "clamp(4rem, 8vw, 6rem) clamp(1.5rem, 4vw, 3rem)",
      }}
    >
      {/* Content row */}
      <div
        style={{
          position:       "relative",
          zIndex:         1,
          maxWidth:       "72rem",
          margin:         "0 auto",
          display:        "flex",
          alignItems:     "flex-end",
          justifyContent: "space-between",
          gap:            "2rem",
          pointerEvents:  "none",
        }}
      >
        <p
          style={{
            textAlign:  "left",
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize:   "clamp(3rem, 8vw, 6.5rem)",
            fontWeight: 400,
            lineHeight: 1,
            color:      "rgba(250,247,240,0.18)",
            userSelect: "none",
            flexShrink: 0,
          }}
        >
          {currentLang ?? ""}
        </p>

        <div style={{ textAlign: "right" }}>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize:   "clamp(2.2rem, 5vw, 3.5rem)",
              fontWeight: 400,
              lineHeight: 1.1,
              color:      "#FAF7F0",
            }}
          >
            Every language,
            <br />
            <em style={{ fontStyle: "italic", color: "rgba(180,220,170,0.9)" }}>one platform.</em>
          </h2>
          <p
            style={{
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontSize:   "0.9rem",
              color:      "rgba(250,247,240,0.55)",
              marginTop:  "0.6rem",
            }}
          >
            {LANG_FLAGS.length}+ languages across 6 regions
          </p>
        </div>
      </div>

      {/* Flag trail — covers whole section */}
      <AnimatePresence>
        {trail.map(flag => (
          <TrailFlag key={flag.id} flag={flag} />
        ))}
      </AnimatePresence>
    </section>
  );
}
