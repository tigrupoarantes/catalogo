import { useRef, useState, useEffect } from "react";
import { LayoutGrid, PawPrint, Coffee, IceCream, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickFilterType = "all" | "purina" | "nespresso" | "nescafe" | "sorvetes";

interface QuickBrandFiltersProps {
  activeFilter: QuickFilterType;
  onChange: (filter: QuickFilterType) => void;
  productsCount: {
    all: number;
    purina: number;
    nespresso: number;
    nescafe: number;
    sorvetes: number;
  };
}

const QuickBrandFilters = ({ activeFilter, onChange, productsCount }: QuickBrandFiltersProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollAmount = clientWidth * 0.75;
      const targetScroll = direction === "left" 
        ? scrollLeft - scrollAmount 
        : scrollLeft + scrollAmount;
      
      scrollContainerRef.current.scrollTo({
        left: targetScroll,
        behavior: "smooth"
      });
    }
  };

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScroll);
      const timer = setTimeout(checkScroll, 100);
      window.addEventListener("resize", checkScroll);
      
      return () => {
        container.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
        clearTimeout(timer);
      };
    }
  }, [productsCount]);

  const filters = [
    {
      id: "all" as const,
      label: "Todos",
      icon: LayoutGrid,
      count: productsCount.all,
      activeClass: "bg-slate-900 text-white shadow-[0_8px_20px_rgba(15,23,42,0.15)]",
      hoverClass: "hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-200",
    },
    {
      id: "purina" as const,
      label: "Purina",
      icon: PawPrint,
      count: productsCount.purina,
      activeClass: "bg-[#E31B23] text-white shadow-[0_8px_20px_rgba(227,27,35,0.2)]",
      hoverClass: "hover:bg-red-50 hover:text-[#E31B23] border border-transparent hover:border-red-200",
    },
    {
      id: "nespresso" as const,
      label: "Nespresso",
      icon: Coffee,
      count: productsCount.nespresso,
      activeClass: "bg-[#A37E58] text-white shadow-[0_8px_20px_rgba(163,126,88,0.2)]",
      hoverClass: "hover:bg-amber-50 hover:text-[#A37E58] border border-transparent hover:border-amber-200",
    },
    {
      id: "nescafe" as const,
      label: "Nescafé",
      icon: Coffee,
      count: productsCount.nescafe,
      activeClass: "bg-[#8C5E3C] text-white shadow-[0_8px_20px_rgba(140,94,60,0.2)]",
      hoverClass: "hover:bg-orange-50 hover:text-[#8C5E3C] border border-transparent hover:border-orange-200",
    },
    {
      id: "sorvetes" as const,
      label: "Sorvetes",
      icon: IceCream,
      count: productsCount.sorvetes,
      activeClass: "bg-[#EC4899] text-white shadow-[0_8px_20px_rgba(236,72,153,0.2)]",
      hoverClass: "hover:bg-pink-50 hover:text-[#EC4899] border border-transparent hover:border-pink-200",
    },
  ];

  return (
    <div className="w-full py-1 relative flex items-center px-10 md:px-12 group">
      {/* Left scroll button */}
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-1 md:left-2 top-[calc(50%-6px)] -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/95 border border-slate-100 flex items-center justify-center shadow-md text-slate-600 hover:text-slate-900 transition-all duration-200 focus:outline-none hover:scale-105 active:scale-95"
          aria-label="Mover para esquerda"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>
      )}

      {/* Horizontal scrolling wrapper with hide scrollbar utilities */}
      <div 
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="w-full flex items-center gap-3 overflow-x-auto no-scrollbar pb-3 justify-start"
      >
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.id;

          return (
            <button
              key={filter.id}
              onClick={() => onChange(filter.id)}
              className={cn(
                "flex items-center gap-1 sm:gap-2 px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs transition-all duration-300 transform select-none shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:scale-[1.03] active:scale-[0.98]",
                isActive
                  ? filter.activeClass
                  : "bg-white text-slate-600 border border-slate-100 " + filter.hoverClass
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{filter.label}</span>
              <span
                className={cn(
                  "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                )}
              >
                {filter.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right scroll button */}
      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-1 md:right-2 top-[calc(50%-6px)] -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/95 border border-slate-100 flex items-center justify-center shadow-md text-slate-600 hover:text-slate-900 transition-all duration-200 focus:outline-none hover:scale-105 active:scale-95"
          aria-label="Mover para direita"
        >
          <ChevronRight className="h-4.5 w-4.5" />
        </button>
      )}
    </div>
  );
};

export default QuickBrandFilters;
