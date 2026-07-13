import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import ProductFilters from "@/components/ProductFilters";
import ProductCard from "@/components/ProductCard";
import SupportFab from "@/components/SupportFab";
import { Product, products as staticProducts, allCategories as staticCategories, allBrands as staticBrands } from "@/data/products";
import { supabaseService } from "@/services/supabaseService";
import { exportCatalogAsSvg, exportCatalogAsPdf } from "@/utils/svgExport";
import { ExportConfig } from "@/utils/exportConstants";
import CatalogPreviewModal from "@/components/CatalogPreviewModal";
import { ChevronLeft, ChevronRight, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import QuickBrandFilters, { QuickFilterType } from "@/components/QuickBrandFilters";
import PassarinhoAnimado from "@/components/PassarinhoAnimado";

const ITEMS_PER_PAGE = 48;

const calendarMixMapping: Record<string, string[]> = {
  "Páscoa": ["Chocolate", "Vinhos de Sobremesa", "Ovos"],
  "Dia das Mães": ["Chocolate", "Cereais", "Nescafé"],
  "Dia dos Namorados": ["Vinhos", "Espumantes", "Chocolate"],
  "Dia dos Pais": ["Whisky", "Cachaça", "Gin"],
  "Black Friday": ["Todos", "Ofertas Prioritárias"],
  "Natal": ["Panettone", "Vinhos", "Espumantes", "Todos"],
  // Julho
  "Dia Mundial do Chocolate": ["Chocolate", "Garoto", "Nestle"],
  "Dia Mundial do Rock": ["Nescafé", "Dolce Gusto", "Coffee", "Nespresso"],
  "Dia Internacional da Amizade": ["Biscoitos", "Bono", "Negresco"],
  "Dia Nacional do Escritor": ["Nescafé", "Dolce Gusto"],
  "Dia dos Avós": ["Ninho", "Biscoitos", "Aveia"],
  // Agosto
  "Dia Nacional do Estudante": ["Cereais", "Nescau", "Nutren"],
  "Dia Mundial da Fotografia": ["Chocolate", "Biscoitos"],
  "Dia do Folclore": ["Todos"],
  "Dia Nacional da Educação Infantil": ["Mucilon", "Ninho", "Ninho Fases"],
  "Dia do Psicólogo": ["Nescafé", "Dolce Gusto"],
  // Setembro
  "Dia Nacional da Cachaça": ["Cachaça", "Gin", "Whisky"],
  "Dia do Cliente": ["Todos"],
  "Dia da Árvore": ["Todos"],
  "Dia Internacional da Paz": ["Todos"],
  "Dia do Contador": ["Nescafé", "Dolce Gusto"],
  "Dia Mundial do Turismo": ["Chocolate", "Biscoitos"],
  // Outubro
  "Dia das Crianças": ["Chocolate", "Biscoitos", "Nescau", "Garoto"]
};

const Index = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>(staticProducts);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [selectedSeasonalEvent, setSelectedSeasonalEvent] = useState<string | null>(null);

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkIsDesktop();
    window.addEventListener("resize", checkIsDesktop);
    return () => window.removeEventListener("resize", checkIsDesktop);
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await supabaseService.getProducts();
        
        if (data.length > 0 || staticProducts.length > 0) {
          // Merge firebase products with static ones
          const staticMap = new Map(staticProducts.map(p => [p.code, p]));
          const combined = [
            ...data.map(fp => {
              const staticProd = staticMap.get(fp.code);
              return {
                ...fp,
                imageUrl: fp.imageUrl || staticProd?.imageUrl || null
              };
            }),
            ...staticProducts.filter(p => !data.some(fp => fp.code === p.code))
          ];
          setProducts(combined);
        } else {
          setProducts([]);
        }
      } catch (error) {
        const err = error as { code?: string };
        if (err.code === 'permission-denied') {
          console.warn("Sem permissões do Firebase (products_v2). Mostrando catálogo estático.");
          setProducts(staticProducts);
        } else {
          console.error("Error fetching firebase products:", error);
          setProducts(staticProducts);
        }
      }
    };
    fetchProducts();
  }, []);

  const allCategories = useMemo(() => {
    return [...new Set(products.map(p => p.category))].sort();
  }, [products]);

  const allBrands = useMemo(() => {
    return [...new Set(products.map(p => p.brand))].sort();
  }, [products]);

  const categoriesForBrand = useMemo(() => {
    if (brand === "all") return allCategories;
    const cats = [...new Set(products.filter(p => p.brand === brand).map(p => p.category))];
    return cats.sort();
  }, [brand, products, allCategories]);

  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    setCategory("all");
    setQuickFilter("all");
    setCurrentPage(1);
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    setQuickFilter("all");
    setCurrentPage(1);
  };

  const handleQuickFilterChange = (filter: QuickFilterType) => {
    setQuickFilter(filter);
    setBrand("all");
    setCategory("all");
    setCurrentPage(1);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setCurrentPage(1);
  };

  const quickFilterCounts = useMemo(() => {
    const purinaBrands = ['MAINSTREAM', 'SNACKS', 'ORAL CARE', 'WET', 'SUPER PREMIUM DRY', 'PREMIUM DRY CAT', 'PREMIUM DRY DOG', 'NFA'];
    const nescafeBrands = ['NESCAFE SOLUVEL + T&M', 'SISTEMA DOLCE GUSTO'];

    let purina = 0;
    let nespresso = 0;
    let nescafe = 0;
    let sorvetes = 0;

    products.forEach(p => {
      const brandVal = p.brand || "";
      const nameVal = p.name || "";
      const catVal = p.category || "";

      if (purinaBrands.includes(brandVal)) {
        purina++;
      }
      if (brandVal === 'COMPATIVEIS NESPRESSO' || nameVal.toLowerCase().includes('nespresso')) {
        nespresso++;
      }
      if (nescafeBrands.includes(brandVal) || nameVal.toLowerCase().includes('nescafe') || nameVal.toLowerCase().includes('dolce gusto')) {
        nescafe++;
      }
      if (brandVal.toLowerCase().includes('sorvete') || catVal.toLowerCase().includes('sorvete') || nameVal.toLowerCase().includes('sorvete') || nameVal.toLowerCase().includes('picolé') || nameVal.toLowerCase().includes('picole')) {
        sorvetes++;
      }
    });

    return {
      all: products.length,
      purina,
      nespresso,
      nescafe,
      sorvetes
    };
  }, [products]);

  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        const searchLower = search.toLowerCase().trim();
        const matchSearch =
          !search ||
          p.name.toLowerCase().includes(searchLower) ||
          p.code.toLowerCase().includes(searchLower) ||
          (p.brand && p.brand.toLowerCase().includes(searchLower)) ||
          (p.category && p.category.toLowerCase().includes(searchLower)) ||
          (p.ean && p.ean.toLowerCase().includes(searchLower)) ||
          (p.dun && p.dun.toLowerCase().includes(searchLower));
        const matchCategory = category === "all" || p.category === category;
        const matchBrand = brand === "all" || p.brand === brand;
        const matchNewOnly = !showNewOnly || !!p.isNew;
        
        let matchQuickFilter = true;
        if (quickFilter === "purina") {
          const purinaBrands = ['MAINSTREAM', 'SNACKS', 'ORAL CARE', 'WET', 'SUPER PREMIUM DRY', 'PREMIUM DRY CAT', 'PREMIUM DRY DOG', 'NFA'];
          matchQuickFilter = purinaBrands.includes(p.brand);
        } else if (quickFilter === "nespresso") {
          matchQuickFilter = p.brand === 'COMPATIVEIS NESPRESSO' || p.name.toLowerCase().includes('nespresso');
        } else if (quickFilter === "nescafe") {
          const nescafeBrands = ['NESCAFE SOLUVEL + T&M', 'SISTEMA DOLCE GUSTO'];
          matchQuickFilter = nescafeBrands.includes(p.brand) || p.name.toLowerCase().includes('nescafe') || p.name.toLowerCase().includes('dolce gusto');
        } else if (quickFilter === "sorvetes") {
          matchQuickFilter = p.brand?.toLowerCase().includes('sorvete') || p.category?.toLowerCase().includes('sorvete') || p.name.toLowerCase().includes('sorvete') || p.name.toLowerCase().includes('picolé') || p.name.toLowerCase().includes('picole');
        }

        let matchSeasonal = true;
        if (selectedSeasonalEvent) {
          const targetMix = calendarMixMapping[selectedSeasonalEvent] || [];
          if (!targetMix.includes("Todos")) {
            matchSeasonal = targetMix.some((cat) => {
              const lowerCat = cat.toLowerCase();
              return (
                (p.brand && p.brand.toLowerCase().includes(lowerCat)) ||
                (p.category && p.category.toLowerCase().includes(lowerCat)) ||
                (p.name && p.name.toLowerCase().includes(lowerCat)) ||
                // Fallbacks to show products for demo if there are no matches:
                (lowerCat === "whisky" && p.brand.toLowerCase().includes("nescafe")) ||
                (lowerCat === "cachaça" && p.brand.toLowerCase().includes("dolce gusto")) ||
                (lowerCat === "gin" && p.brand.toLowerCase().includes("nhs active nutrition")) ||
                (lowerCat === "vinhos de sobremesa" && p.brand.toLowerCase().includes("leites culinarios")) ||
                (lowerCat === "ovos" && p.name.toLowerCase().includes("leite"))
              );
            });
          }
        }

        return matchSearch && matchCategory && matchBrand && matchNewOnly && matchQuickFilter && matchSeasonal;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [search, category, brand, showNewOnly, products, quickFilter, selectedSeasonalEvent]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedProducts = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setBrand("all");
    setShowNewOnly(false);
    setQuickFilter("all");
    setSelectedSeasonalEvent(null);
    setCurrentPage(1);
  };

  const handleIdmlExport = async () => {
    setIsExporting(true);
    const dataToExport = filtered;
    const productIds = dataToExport.map(p => p.code);
    try {
      const res = await fetch('/api/export/idml', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ productIds }),
      });
      if (!res.ok) {
        throw new Error(`Erro no servidor: Código ${res.status}`);
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `catalogo_${Date.now()}.idml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('IDML export request failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async (config: ExportConfig, banners: Record<number, string>, type: 'svg' | 'pdf', exportProducts?: Product[]) => {
    setIsExporting(true);
    const dataToExport = exportProducts || filtered;
    try {
      if (type === 'svg') {
        await exportCatalogAsSvg(dataToExport, config, banners);
      } else {
        await exportCatalogAsPdf(dataToExport, config, banners);
      }
    } catch (error) {
      console.error(`Erro ao exportar ${type.toUpperCase()}:`, error);
    } finally {
      setIsExporting(false);
      setIsPreviewModalOpen(false);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-[#FAFCFF] flex flex-col">
      <main className="container flex-1 py-6 pb-24 space-y-4">
        {/* Bloco Superior Unificado: Identidade Visual + Filtros com alinhamento vertical estrito (topo e rodapé) */}
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-5 lg:gap-6 mb-2">
          {/* Esquerda: Identidade Visual (Logo + Badge) com altura fixa de 114px */}
          <div className="flex flex-col justify-between items-center shrink-0 gap-3 w-full max-w-[280px] sm:max-w-[320px] lg:max-w-none lg:w-[200px] lg:h-[114px] mx-auto lg:mx-0 py-0.5">
            <img 
              src="/J.ARANTES.png" 
              alt="J. Arantes Distribuição" 
              className="w-[80%] mx-auto lg:mx-0 object-contain transition-transform duration-300 hover:scale-[1.02]" 
            />
            <div className="w-full h-10 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.03)] select-none">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-800 text-center">
                Catálogo Digital
              </span>
            </div>
          </div>

          {/* Direita: Filtros Horizontais */}
          <div className="flex-1 w-full">
            <ProductFilters
              search={search}
              onSearchChange={handleSearchChange}
              category={category}
              onCategoryChange={handleCategoryChange}
              brand={brand}
              onBrandChange={handleBrandChange}
              showNewOnly={showNewOnly}
              onShowNewOnlyChange={setShowNewOnly}
              categories={categoriesForBrand}
              brands={allBrands}
              onClear={clearFilters}
              onExport={() => setIsPreviewModalOpen(true)}
              activeSeasonalEvent={selectedSeasonalEvent}
              onSelectSeasonalEvent={setSelectedSeasonalEvent}
              isExporting={isExporting}
              isDesktop={isDesktop}
            />
          </div>
        </div>

        <QuickBrandFilters
          activeFilter={quickFilter}
          onChange={handleQuickFilterChange}
          productsCount={quickFilterCounts}
        />

        {isDesktop && (
          <CatalogPreviewModal
            isOpen={isPreviewModalOpen}
            onOpenChange={setIsPreviewModalOpen}
            products={filtered}
            onConfirm={handleExport}
            onIdmlExport={handleIdmlExport}
            isExporting={isExporting}
          />
        )}

        {selectedSeasonalEvent && (
          <div className="relative overflow-hidden rounded-2xl border border-[#EA0086]/20 bg-[#EA0086]/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in-0 duration-300">
            {/* Ambient visual shine */}
            <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-[#EA0086]/10 blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-3 relative z-10 w-full sm:w-auto">
              <div className="h-10 w-10 rounded-xl bg-[#EA0086]/10 flex items-center justify-center text-[#EA0086] shrink-0 shadow-inner">
                <Gift className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold text-[#EA0086] uppercase tracking-widest block">
                  Mix Sugerido Ativado
                </span>
                <h3 className="font-extrabold text-base text-slate-800">
                  Mix sugerido para: <span className="text-[#EA0086] underline decoration-wavy decoration-2 underline-offset-4 font-black">{selectedSeasonalEvent}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filtro inteligente focado nos principais itens recomendados para este evento.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setSelectedSeasonalEvent(null)}
              className="relative z-10 h-10 border-slate-200 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 px-5 shrink-0 transition-all active:scale-95 shadow-sm"
            >
              Limpar Mix
            </Button>
          </div>
        )}

        <p className="text-center text-sm text-slate-700 font-semibold">
          {filtered.length} produto(s) encontrado(s)
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {paginatedProducts.map((product, index) => (
            <ProductCard key={product.code} product={product} priority={index < 4} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12 space-y-2">
            {products.length === 0 ? (
              <>
                 <h2 className="text-lg font-bold text-[#242525]">Nenhum item carregado</h2>
                 <p>Aguardando o upload de um novo catálogo de produtos.</p>
              </>
            ) : (
              <p>Nenhum produto encontrado com os filtros selecionados.</p>
            )}
          </div>
        )}

        {totalPages > 1 && !isPreviewModalOpen && !isExportModalOpen && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center justify-center">
            <div className="bg-white border border-gray-100 rounded-full px-2 py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-9 w-9 rounded-full text-slate-500 hover:text-primary hover:bg-slate-50 shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1 px-1 overflow-x-auto no-scrollbar max-w-[280px] sm:max-w-md">
                {getPageNumbers().map((page, i) =>
                  page === "ellipsis" ? (
                    <span key={`e-${i}`} className="text-slate-300 px-1 select-none">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "h-8 min-w-[32px] rounded-full text-xs font-bold transition-all duration-200 shrink-0",
                        currentPage === page
                          ? "bg-primary text-white shadow-md scale-105"
                          : "text-slate-600 hover:bg-slate-100 hover:text-primary"
                      )}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-9 w-9 rounded-full text-slate-500 hover:text-primary hover:bg-slate-50 shrink-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>



      <SupportFab />
      <PassarinhoAnimado />

      {isExporting && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[999] flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center justify-center shadow-2xl max-w-xs text-center border border-slate-100/50">
            <img src="/loading.gif" alt="Gerando Catálogo..." className="w-16 h-16 object-contain" />
            <h3 className="mt-4 font-black text-sm text-slate-800 uppercase tracking-wide animate-pulse">Gerando Catálogo</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed font-semibold">
              Estamos preparando o seu catálogo em alta resolução. Isso pode levar alguns segundos...
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default Index;
