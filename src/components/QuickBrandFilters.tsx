import { LayoutGrid, PawPrint, Coffee, IceCream } from "lucide-react";
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
    <div className="w-full py-1">
      {/* Horizontal scrolling wrapper with hide scrollbar utilities */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-3 justify-start px-4 md:px-6">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.id;

          return (
            <button
              key={filter.id}
              onClick={() => onChange(filter.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all duration-300 transform select-none shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:scale-[1.03] active:scale-[0.98]",
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
    </div>
  );
};

export default QuickBrandFilters;
