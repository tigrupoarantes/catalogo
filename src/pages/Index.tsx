import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import ProductFilters from "@/components/ProductFilters";
import ProductCard from "@/components/ProductCard";
import SupportFab from "@/components/SupportFab";
import { products as staticProducts, allCategories as staticCategories, allBrands as staticBrands } from "@/data/products";
import { supabaseService } from "@/services/supabaseService";
import { exportCatalogAsSvg, exportCatalogAsPdf } from "@/utils/svgExport";
import { ExportConfig } from "@/utils/exportConstants";
import CatalogPreviewModal from "@/components/CatalogPreviewModal";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const ITEMS_PER_PAGE = 48;

const Index = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState(staticProducts);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

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
                imageUrl: staticProd?.imageUrl || fp.imageUrl
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
    setCurrentPage(1);
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    setCurrentPage(1);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        const matchSearch =
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.code.includes(search);
        const matchCategory = category === "all" || p.category === category;
        const matchBrand = brand === "all" || p.brand === brand;
        return matchSearch && matchCategory && matchBrand;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [search, category, brand, products]);

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
    setCurrentPage(1);
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
    <div className="min-h-screen bg-[#606060] flex flex-col">
      {/* Topo do site com fundo branco */}
      <header className="w-full bg-white border-b border-slate-100/80 shadow-sm">
        <div className="container py-3 flex flex-col items-center justify-center text-center">
          <img 
            src="/J.ARANTES.png" 
            alt="J. Arantes Distribuição" 
            className="h-14 sm:h-16 object-contain max-w-[240px] sm:max-w-[280px] transition-transform duration-300 hover:scale-[1.02]" 
          />
        </div>
      </header>

      <main className="container flex-1 py-4 pb-24 space-y-4">
        {/* Frase "Catálogo Digital" entre o topo e a busca */}
        <div className="text-center">
          <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] text-white">
            Catálogo Digital
          </p>
        </div>
        <ProductFilters
          search={search}
          onSearchChange={handleSearchChange}
          category={category}
          onCategoryChange={handleCategoryChange}
          brand={brand}
          onBrandChange={handleBrandChange}
          categories={categoriesForBrand}
          brands={allBrands}
          onClear={clearFilters}
          onExport={() => setIsPreviewModalOpen(true)}
          isExporting={isExporting}
          isDesktop={isDesktop}
        />

        {isDesktop && (
          <CatalogPreviewModal
            isOpen={isPreviewModalOpen}
            onOpenChange={setIsPreviewModalOpen}
            products={filtered}
            onConfirm={handleExport}
            isExporting={isExporting}
          />
        )}

        <p className="text-center text-sm text-muted-foreground">
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

      <footer className="border-t border-slate-200/60 bg-white/50 py-8 text-center mt-12">
        <Button 
          variant="link" 
          onClick={() => navigate("/admin")} 
          className="text-slate-400 hover:text-blue-600 text-xs font-semibold tracking-wide transition-colors"
        >
          Painel Admin
        </Button>
      </footer>

      <SupportFab />
    </div>
  );
};

export default Index;
