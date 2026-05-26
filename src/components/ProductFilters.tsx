import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface ProductFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  categories: string[];
  brands: string[];
  onClear: () => void;
  onExport: () => void;
  isExporting?: boolean;
  isDesktop?: boolean;
}

const ProductFilters = ({
  search, onSearchChange, category, onCategoryChange,
  brand, onBrandChange, categories, brands, onClear, onExport, isExporting, isDesktop,
}: ProductFiltersProps) => {
  const hasFilters = search || category !== "all" || brand !== "all";

  return (
    <div className="rounded-xl border p-6 shadow-sm text-card-foreground" style={{ backgroundColor: '#ffffff' }}>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-4 items-end">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-card-foreground">Buscar produtos</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou código do produto..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-card-foreground">Marca</label>
          <Select value={brand} onValueChange={onBrandChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas as marcas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as marcas</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-card-foreground">Mix de Produtos</label>
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {hasFilters && (
              <Button variant="ghost" onClick={onClear} className="gap-2" disabled={isExporting}>
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
            
            {isDesktop ? (
              <Button 
                onClick={onExport} 
                className="gap-2 bg-[#242525] hover:bg-[#101111] px-8"
                disabled={isExporting}
              >
                {isExporting ? "Processando..." : "Gerar Catálogo"}
              </Button>
            ) : null}
          </div>
          
          {!isDesktop && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-[#242525] font-medium leading-tight max-w-[200px]">
              A geração de catálogos está disponível apenas em computadores para garantir a melhor qualidade de diagramação.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductFilters;
