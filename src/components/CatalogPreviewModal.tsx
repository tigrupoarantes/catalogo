import React, { useMemo, useState } from "react";
import { Product } from "@/data/products";
import { ExportConfig } from "@/utils/exportConstants";
import { generatePageSvg } from "@/utils/svgExport";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, FileDown, ArrowLeft, Settings2, Image as ImageIcon, Trash2, Upload, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

interface CatalogPreviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onConfirm: (config: ExportConfig, banners: Record<number, string>, type: 'svg' | 'pdf', filteredProducts?: Product[]) => void;
  onIdmlExport?: (config: ExportConfig) => void;
  isExporting: boolean;
}

const CatalogPreviewModal: React.FC<CatalogPreviewModalProps> = ({
  isOpen,
  onOpenChange,
  products,
  onConfirm,
  onIdmlExport,
  isExporting,
}) => {
  const [config, setConfig] = useState<ExportConfig>({
    showBrand: true,
    showCategory: true,
    showName: true,
    showCode: true,
    showBox: true,
    showEan: true,
    sidebarColor: "#EA0086",
  });

  const fields = [
    { id: "showBrand", label: "Categoria" },
    { id: "showCategory", label: "Sub Categoria" },
    { id: "showName", label: "Descrição do Produto" },
    { id: "showCode", label: "Cód. (Código)" },
    { id: "showBox", label: "Caixa (Unidade)" },
    { id: "showEan", label: "EAN (Barcode)" },
  ];

  const handleToggle = (id: keyof ExportConfig) => {
    setConfig((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Mix Selection State
  const brandCategoryMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    products.forEach(p => {
      if (!map[p.brand]) map[p.brand] = new Set();
      map[p.brand].add(p.category);
    });
    return map;
  }, [products]);

  const uniqueBrands = useMemo(() => Array.from(new Set(products.map(p => p.brand))).sort((a, b) => a.localeCompare(b, "pt-BR")), [products]);
  const allUniqueCategories = useMemo(() => Array.from(new Set(products.map(p => p.category))).sort((a, b) => a.localeCompare(b, "pt-BR")), [products]);

  const [selectedMix, setSelectedMix] = useState<{ brands: string[], categories: string[] }>({
    brands: [],
    categories: []
  });

  // Initialize selectedMix when modal opens with all items if not set
  React.useEffect(() => {
    if (isOpen) {
      setSelectedMix({
        brands: uniqueBrands,
        categories: allUniqueCategories,
      });
      setCurrentPageIdx(0);
    }
  }, [isOpen, uniqueBrands, allUniqueCategories]);

  const visibleCategories = useMemo(() => {
    if (selectedMix.brands.length === 0) {
      return allUniqueCategories;
    }
    const valid = new Set<string>();
    selectedMix.brands.forEach(b => {
      if (brandCategoryMap[b]) {
        brandCategoryMap[b].forEach(c => valid.add(c));
      }
    });
    return Array.from(valid).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allUniqueCategories, brandCategoryMap, selectedMix.brands]);

  React.useEffect(() => {
    setSelectedMix(prev => {
      const newCats = prev.categories.filter(c => visibleCategories.includes(c));
      if (newCats.length !== prev.categories.length) {
        return { ...prev, categories: newCats };
      }
      return prev;
    });
  }, [visibleCategories]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      selectedMix.brands.includes(p.brand) && 
      selectedMix.categories.includes(p.category)
    );
  }, [products, selectedMix]);

  const handleMixToggle = (type: 'brands' | 'categories', value: string) => {
    setSelectedMix(prev => {
      const currentList = prev[type];
      const isSelected = currentList.includes(value);
      return {
        ...prev,
        [type]: isSelected 
          ? currentList.filter(item => item !== value)
          : [...currentList, value]
      };
    });
  };

  const clearMix = () => {
    setSelectedMix({
      brands: uniqueBrands,
      categories: allUniqueCategories
    });
  };

  const pages = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    filteredProducts.forEach((p) => {
      if (!grouped[p.brand]) grouped[p.brand] = [];
      grouped[p.brand].push(p);
    });

    const entries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
    
    const result: { brand: string; products: Product[]; categoryHint: string; pageNum: number; totalInBrand: number }[] = [];
    const itemsPerPage = 12;
    
    entries.forEach(([brand, brandProducts]) => {
      const sortedBrandProducts = [...brandProducts].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const totalPages = Math.ceil(sortedBrandProducts.length / itemsPerPage);
      
      for (let i = 0; i < totalPages; i++) {
        const pageProducts = sortedBrandProducts.slice(i * itemsPerPage, (i + 1) * itemsPerPage);
        result.push({
          brand,
          products: pageProducts,
          categoryHint: pageProducts.length > 0 ? pageProducts[0].category : "",
          pageNum: i + 1,
          totalInBrand: totalPages,
        });
      }
    });

    return result;
  }, [filteredProducts]);

  const [currentPageIdx, setCurrentPageIdx] = React.useState(0);
  const [pageBanners, setPageBanners] = useState<Record<number, string>>({});

  React.useEffect(() => {
    if (currentPageIdx >= pages.length) {
      setCurrentPageIdx(Math.max(0, pages.length - 1));
    }
  }, [pages.length, currentPageIdx]);

  const currentPage = pages[currentPageIdx];

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPageBanners(prev => ({
        ...prev,
        [currentPageIdx]: dataUrl
      }));
    };
    reader.readAsDataURL(file);
    
    // Clear the input value so the same file could be selected again for another page
    e.target.value = "";
  };

  const removeBanner = () => {
    setPageBanners(prev => {
      const newBanners = { ...prev };
      delete newBanners[currentPageIdx];
      return newBanners;
    });
  };

  // SVG Generation for the current page
  const pageSvg = useMemo(() => {
    if (!currentPage) return "";
    return generatePageSvg(
      currentPage.products,
      currentPage.brand,
      currentPage.categoryHint,
      `${currentPage.pageNum}`,
      config,
      pageBanners[currentPageIdx]
    );
  }, [currentPage, config, pageBanners, currentPageIdx]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1250px] w-[98vw] h-[95vh] flex flex-col p-0 overflow-hidden bg-[#F1F5F9] border-none shadow-2xl">
        <DialogHeader className="p-4 bg-white border-b flex-row justify-between items-center space-y-0 shrink-0 h-16">
          <div className="flex items-center gap-4">
            <DialogTitle className="text-[#242525] flex items-center gap-2">
              Pré-visualização do Catálogo (WYSIWYG)
            </DialogTitle>
            <div className="hidden md:flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Status:</span>
              <span className="text-xs text-[#242525] font-bold uppercase">{filteredProducts.length} itens filtrados</span>
            </div>
          </div>
          <div className="flex items-center gap-4 pr-16">
             <span className="text-sm text-gray-500 font-medium whitespace-nowrap">
              Página {currentPageIdx + 1} de {pages.length}
            </span>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-full border-[#242525]/20 bg-white" 
                onClick={() => setCurrentPageIdx(p => Math.max(0, p - 1))}
                disabled={currentPageIdx === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-full border-[#242525]/20 bg-white" 
                onClick={() => setCurrentPageIdx(p => Math.min(pages.length - 1, p + 1))}
                disabled={currentPageIdx === pages.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-grow overflow-hidden">
          <div className="w-72 bg-white border-r p-6 hidden lg:flex flex-col gap-6 shrink-0 overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-[#242525] font-bold text-sm uppercase tracking-wider">
                <Settings2 className="h-4 w-4" /> Configurações
              </div>
              <div className="space-y-2">
                {fields.map((field) => (
                  <div key={field.id} className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                    <Checkbox
                      id={`preview-${field.id}`}
                      checked={config[field.id as keyof ExportConfig]}
                      onCheckedChange={() => handleToggle(field.id as keyof ExportConfig)}
                      className="h-5 w-5 border-[#242525] data-[state=checked]:bg-[#242525]"
                    />
                    <Label
                      htmlFor={`preview-${field.id}`}
                      className="text-[13px] font-semibold leading-none cursor-pointer text-gray-600 select-none flex-1"
                    >
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#242525] font-bold text-sm uppercase tracking-wider">
                    <Filter className="h-4 w-4" /> Selecionar Meu Mix
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
                    onClick={clearMix}
                    title="Limpar Mix"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase">Categorias Disponíveis</Label>
                    <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                      {uniqueBrands.map(brand => (
                        <div key={`brand-${brand}`} className="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                          <Checkbox
                            id={`mix-brand-${brand}`}
                            checked={selectedMix.brands.includes(brand)}
                            onCheckedChange={() => handleMixToggle('brands', brand)}
                            className="h-4 w-4 border-[#242525] data-[state=checked]:bg-[#242525]"
                          />
                          <Label
                            htmlFor={`mix-brand-${brand}`}
                            className="text-[12px] font-medium cursor-pointer text-gray-600 select-none flex-1 truncate"
                          >
                            {brand}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-2 border-gray-100">
                    <Label className="text-xs font-bold text-gray-400 uppercase">Sub Categorias de Mix</Label>
                    <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                      {visibleCategories.map(cat => (
                        <div key={`cat-${cat}`} className="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                          <Checkbox
                            id={`mix-cat-${cat}`}
                            checked={selectedMix.categories.includes(cat)}
                            onCheckedChange={() => handleMixToggle('categories', cat)}
                            className="h-4 w-4 border-[#242525] data-[state=checked]:bg-[#242525]"
                          />
                          <Label
                            htmlFor={`mix-cat-${cat}`}
                            className="text-[12px] font-medium cursor-pointer text-gray-600 select-none flex-1 truncate"
                          >
                            {cat}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-[#242525] font-bold text-sm uppercase tracking-wider">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: config.sidebarColor }} /> Cor da Faixa Lateral
                </div>
                <div className="flex items-center gap-3 p-2 border rounded-lg bg-gray-50">
                  <input
                    type="color"
                    id="sidebarColor"
                    value={config.sidebarColor || "#EA0086"}
                    onChange={(e) => setConfig(prev => ({ ...prev, sidebarColor: e.target.value }))}
                    className="h-8 w-8 cursor-pointer border-none bg-transparent"
                  />
                  <Label
                    htmlFor="sidebarColor"
                    className="text-[12px] font-bold text-gray-500 uppercase flex-1"
                  >
                    Personalizar Cor
                  </Label>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-[#242525] font-bold text-sm uppercase tracking-wider">
                  <ImageIcon className="h-4 w-4" /> Banner da Página
                </div>
                
                {pageBanners[currentPageIdx] ? (
                  <div className="space-y-3">
                    <div className="relative group aspect-[3/1] rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                      <img 
                        src={pageBanners[currentPageIdx]} 
                        alt="Banner Preview" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="h-8 w-8 rounded-full"
                          onClick={removeBanner}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="w-full text-xs h-9 border-dashed"
                        onClick={() => document.getElementById('banner-upload')?.click()}
                      >
                        Trocar Banner
                      </Button>
                      <Button 
                        variant="secondary" 
                        className="w-full text-xs h-9"
                        onClick={() => {
                          const currentBanner = pageBanners[currentPageIdx];
                          if (currentBanner) {
                            const newBanners: Record<number, string> = {};
                            pages.forEach((_, idx) => {
                              newBanners[idx] = currentBanner;
                            });
                            setPageBanners(newBanners);
                          }
                        }}
                      >
                        Aplicar em Todas
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => document.getElementById('banner-upload')?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-[#242525]/30 hover:bg-[#242525]/5 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-[#242525] group-hover:bg-white transition-colors shadow-sm">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-[11px] font-bold text-gray-400 group-hover:text-[#242525] uppercase tracking-wider text-center">
                      Upload Banner<br/>Página {currentPageIdx + 1}
                    </p>
                  </div>
                )}
                
                <input 
                  id="banner-upload"
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleBannerUpload}
                />
                
                <p className="text-[10px] text-gray-400 leading-tight">
                  Recomendado: Imagem horizontal (proporção 4:1 ou similar) para cobrir o topo da página.
                </p>
              </div>
            </div>

            <div className="mt-auto p-4 bg-[#242525]/5 rounded-xl border border-[#242525]/10">
              <p className="text-[10px] text-[#242525]/60 font-medium leading-relaxed">
                Este preview utiliza o motor de renderização real do SVG. O que você vê aqui é exatamente o que será exportado.
              </p>
            </div>
          </div>

          {/* SVG Render Container */}
          <div className="flex-grow overflow-y-auto p-8 md:p-12 bg-[#E2E8F0] flex justify-center items-start scroll-smooth">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full w-full max-w-md mx-auto text-center space-y-4 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <Filter className="h-8 w-8 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-[#242525] font-bold text-lg">
                    {products.length === 0 ? 'Nenhum item carregado' : 'Nenhum produto encontrado'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {products.length === 0 
                      ? 'Aguardando o upload de um novo catálogo para iniciar a montagem.' 
                      : 'Nenhum produto encontrado para este mix selecionado. Tente ajustar os filtros na barra lateral.'}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={clearMix}
                  className="mt-4 border-[#242525] text-[#242525] hover:bg-[#242525]/5 font-bold text-xs uppercase tracking-widest"
                >
                  <X className="h-4 w-4 mr-2" /> Limpar Filtros
                </Button>
              </div>
            ) : (
                <div 
                  className="bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)] relative mb-12 flex items-center justify-center overflow-hidden rounded-sm"
                  style={{ 
                    width: '100%',
                    maxWidth: '800px',
                    aspectRatio: '210/297', // A4 Ratio
                  }}
                  dangerouslySetInnerHTML={{ __html: pageSvg }}
                />
            )}
          </div>
        </div>

        <DialogFooter className="p-4 bg-white border-t sm:justify-between items-center gap-4 shrink-0 h-20 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-[#242525] font-bold text-xs uppercase tracking-widest hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div className="flex gap-3 w-full sm:w-auto">
            {onIdmlExport && (
              <Button 
                variant="outline"
                onClick={() => onIdmlExport(config)}
                disabled={isExporting || pages.length === 0}
                className="flex-grow sm:flex-none border-[#EA0086] text-[#EA0086] hover:bg-[#EA0086]/5 font-bold text-xs uppercase tracking-widest px-6 h-11"
              >
                {isExporting ? (
                  <>
                    <Spinner size="sm" className="mr-2 text-[#EA0086]" />
                    Preparando arquivo para Adobe...
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4 mr-2" /> 
                    Exportar IDML
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => onConfirm(config, pageBanners, 'svg', filteredProducts)}
              disabled={isExporting || pages.length === 0}
              className="flex-grow sm:flex-none border-[#242525] text-[#242525] hover:bg-[#242525]/5 font-bold text-xs uppercase tracking-widest px-6 h-11"
            >
              <FileDown className="h-4 w-4 mr-2" /> 
              {isExporting ? "Exportando..." : "Exportar SVG"}
            </Button>
            <Button 
              onClick={() => onConfirm(config, pageBanners, 'pdf', filteredProducts)}
              disabled={isExporting || pages.length === 0}
              className="flex-grow sm:flex-none bg-[#242525] hover:bg-[#101111] shadow-lg shadow-[#242525]/20 font-bold text-xs uppercase tracking-widest px-12 h-11"
            >
              <FileDown className="h-4 w-4 mr-2" /> 
              {isExporting ? "Gerando PDF..." : "Confirmar e Gerar PDF"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CatalogPreviewModal;

