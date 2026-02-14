

import { ReactNode, useState, useEffect } from 'react';

export interface Flashcard {
  id: string;
  front: ReactNode;
  back: ReactNode;
}

interface FlashCardProps {
  card: Flashcard;
  showAnswer?: boolean;
}

export function FlashCard({ card, showAnswer = false }: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(showAnswer);

  // Sync isFlipped state when showAnswer prop changes
  useEffect(() => {
    setIsFlipped(showAnswer);
  }, [showAnswer]);

  return (
    <div
      role="button"
      tabIndex={0}
      className="relative w-full h-80 md:h-96 cursor-pointer perspective-1000 group focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-xl"
      onClick={() => setIsFlipped(!isFlipped)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsFlipped(!isFlipped);
        }
      }}
    >
      <div
        className={`relative w-full h-full duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''
          }`}
      >
        {/* Front */}
        <div className="absolute w-full h-full backface-hidden transition-all duration-300">
          <div className="w-full h-full p-4 md:p-8 bg-white rounded-xl border-2 border-neo-border shadow-neo group-hover:shadow-neo-hover flex items-center justify-center overflow-hidden">
            <p className="text-lg md:text-2xl lg:text-3xl font-heading font-bold text-center leading-relaxed break-words overflow-y-auto max-h-full scrollbar-hide">
              {card.front}
            </p>
          </div>
        </div>

        {/* Back */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 transition-all duration-300">
          <div className="w-full h-full p-4 md:p-8 bg-neo-accent-blue/30 rounded-xl border-2 border-neo-border shadow-neo group-hover:shadow-neo-hover flex items-center justify-center overflow-hidden">
            <div className="text-lg md:text-2xl lg:text-3xl font-heading font-bold text-center leading-relaxed break-words overflow-y-auto max-h-full scrollbar-hide">
              {card.back}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}