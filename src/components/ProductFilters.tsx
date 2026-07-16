import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import BotaoLancamentos from "./BotaoLancamentos";
import BotaoCalendario from "./BotaoCalendario";

interface ProductFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  showNewOnly: boolean;
  onShowNewOnlyChange: (value: boolean) => void;
  categories: string[];
  brands: string[];
  onClear: () => void;
  onExport: () => void;
  activeSeasonalEvent: string | null;
  onSelectSeasonalEvent: (eventName: string | null) => void;
  isExporting?: boolean;
  isDesktop?: boolean;
}

const ProductFilters = ({
  search, onSearchChange, category, onCategoryChange,
  brand, onBrandChange, showNewOnly, onShowNewOnlyChange, categories, brands, onClear, onExport,
  activeSeasonalEvent, onSelectSeasonalEvent, isExporting, isDesktop,
}: ProductFiltersProps) => {
  const hasFilters = search || category !== "all" || brand !== "all" || activeSeasonalEvent !== null;

  return (
    <div className="rounded-2xl border border-slate-100/40 p-5 shadow-[0_10px_35px_rgba(0,0,0,0.03)] text-card-foreground bg-white">
      <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_auto_1.2fr_1.2fr_auto] gap-4 lg:gap-5 items-end">
        <div className="space-y-2 w-full">
          <label className="text-sm font-bold text-slate-800 block pl-1">Buscar produtos</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Nome ou código do produto..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-11 h-11 bg-white border-none rounded-xl font-bold text-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>
        
        <div className="shrink-0 grid grid-cols-2 md:flex gap-2 items-center w-full md:w-auto">
          <BotaoLancamentos showNewOnly={showNewOnly} onShowNewOnlyChange={onShowNewOnlyChange} disabled={isExporting} />
          <BotaoCalendario activeEvent={activeSeasonalEvent} onSelectEvent={onSelectSeasonalEvent} disabled={isExporting} />
        </div>
        
        <div className="space-y-2 w-full">
          <label className="text-sm font-bold text-slate-800 block pl-1">Categoria</label>
          <Select value={brand} onValueChange={onBrandChange}>
            <SelectTrigger className="w-full h-11 bg-white border-none rounded-xl px-4 font-bold text-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 focus:ring-2 focus:ring-primary select-none">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100 shadow-lg">
              <SelectItem value="all">Todas as categorias</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2 w-full">
          <label className="text-sm font-bold text-slate-800 block pl-1">Sub Categoria</label>
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full h-11 bg-white border-none rounded-xl px-4 font-bold text-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 focus:ring-2 focus:ring-primary select-none">
              <SelectValue placeholder="Todas as subcategorias" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100 shadow-lg">
              <SelectItem value="all">Todas as subcategorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex gap-2 justify-end w-full">
            {hasFilters && (
              <Button 
                variant="ghost" 
                onClick={onClear} 
                className="gap-2 h-11 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 px-4 transition-all duration-300 shrink-0" 
                disabled={isExporting}
              >
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
            
            {isDesktop ? (
              <Button 
                onClick={onExport} 
                className="gap-2 bg-[#1e1f1f] hover:bg-black text-white px-6 h-11 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.16)] transition-all duration-300 shrink-0"
                disabled={isExporting}
              >
                {isExporting ? "Processando..." : "Gerar Catálogo"}
              </Button>
            ) : null}
          </div>
          

        </div>
      </div>
    </div>
  );
};

export default ProductFilters;
