import React, { useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotaoLancamentosProps {
  showNewOnly: boolean;
  onShowNewOnlyChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function BotaoLancamentos({ showNewOnly, onShowNewOnlyChange, disabled }: BotaoLancamentosProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const createExplosion = (e: React.MouseEvent<HTMLButtonElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redimensiona o canvas para preencher a tela inteira em altíssima resolução (High DPI/Retina)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    // Coordenadas globais do clique na janela
    const clickX = e.clientX;
    const clickY = e.clientY;

    // Configuração das partículas dos fogos (aumentado para 120 para impacto massivo)
    const particleCount = 120;
    const particles: any[] = [];
    const colors = ['#FFD700', '#FF4500', '#FF1493', '#00FFFF', '#32CD32', '#FFFFFF', '#FF8C00', '#9400D3'];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Velocidade de dispersão ampliada para alcançar a tela inteira
      const speed = Math.random() * 8 + 2; 
      particles.push({
        x: clickX,
        y: clickY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 1.2, // Partículas maiores e nítidas
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 0.012 + 0.008, // Desaparecimento mais lento para flutuação charmosa
        sparkle: Math.random() > 0.4 // 40% das partículas piscam com brilho extra
      });
    }

    // Loop de renderização da animação
    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let stillActive = false;

      particles.forEach((p) => {
        if (p.alpha > 0) {
          stillActive = true;
          
          // Física de movimento: velocidade + gravidade + resistência do ar (atrito)
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.98; // Atrito do ar
          p.vy *= 0.98; 
          p.vy += 0.06; // Gravidade sutil
          
          p.alpha -= p.decay;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.beginPath();
          
          // Efeito cintilante wobbly nas partículas marcadas como "sparkle"
          const currentRadius = p.sparkle && Math.random() > 0.5 
            ? p.radius * 1.6 
            : p.radius;
            
          ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          
          // Glow de altíssima qualidade
          ctx.shadowBlur = 12;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.restore();
        }
      });

      if (stillActive) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    animate();
  };

  return (
    <div className="relative inline-block w-full md:w-auto">
      {/* Canvas fixo na janela inteira, permitindo que as partículas transbordem por todo o site */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[999] w-screen h-screen"
        style={{ width: '100vw', height: '100vh' }}
      />
      
      <button
        type="button"
        onClick={(e) => {
          createExplosion(e);
          onShowNewOnlyChange(!showNewOnly);
        }}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1.5 rounded-xl border-[2.5px] px-2 md:px-5 py-2 h-11 font-black transition-all duration-150 active:scale-95 select-none w-full md:w-auto shadow-sm",
          showNewOnly
            ? "bg-[#4267B2] border-[#222222] text-white active:bg-[#365499]"
            : "bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50 hover:border-slate-300"
        )}
        disabled={disabled}
      >
        {/* Ícone de Brilho / Sparkles (SVG embutido puro) */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="animate-pulse shrink-0"
        >
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" opacity="0.8" />
          <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" opacity="0.8" />
        </svg>
        <span className="tracking-wide text-[10px] md:text-xs leading-tight uppercase">Lançamentos</span>
      </button>
    </div>
  );
}
