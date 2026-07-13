import { useState } from 'react';

export default function PassarinhoAnimado() {
  const [birdTop, setBirdTop] = useState("20%");

  const handleAnimationIteration = () => {
    // Random height percentage between 10% and 60% to avoid headers/footers
    const randomTop = Math.floor(Math.random() * 50) + 10;
    setBirdTop(`${randomTop}%`);
  };

  return (
    <div 
      className="passarinho-animado"
      style={{ top: birdTop }}
      onAnimationIteration={handleAnimationIteration}
    >
      <svg 
        viewBox="0 0 64 64" 
        className="w-[100px] h-[100px] fill-[#426EA8] drop-shadow-md"
      >
        {/* Tail */}
        <path d="M12 36 L4 30 L6 42 Z" />
        
        {/* Body/Head */}
        <path d="M10 36 C18 24, 38 24, 46 32 C50 30, 54 30, 58 32 C58 35, 52 38, 48 38 C42 46, 22 46, 10 36 Z" />
        
        {/* Beak */}
        <path d="M58 32 L62 34 L56 36 Z" fill="#FFA500" />
        
        {/* Eye */}
        <circle cx="48" cy="32" r="2.5" fill="white" />
        <circle cx="48.5" cy="31.5" r="1" fill="black" />
        
        {/* Wing with flapping animation */}
        <path 
          className="animate-flapping" 
          d="M28 34 C24 18, 12 18, 16 34 C20 44, 28 44, 28 34 Z" 
          fill="#5283C4" 
        />
      </svg>
    </div>
  );
}
