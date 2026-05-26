import { useState } from "react";
import type { Product } from "@/data/products";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { ExportConfig } from "@/utils/exportConstants";

const STORAGE_BASE = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_URL = `${STORAGE_BASE}/storage/v1/object/public/product-images`;

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  config?: ExportConfig;
}

const ProductCard = ({ product, priority = false, config }: ProductCardProps) => {
  const [imgError, setImgError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  // Use the pre-mapped local image URL if it exists
  const thumbnailUrl = product.imageUrl || `${STORAGE_URL}/${product.code}.png`;
  const fullImageUrl = product.imageUrl || `${STORAGE_URL}/${product.code}.png`;

  // Default config if not provided (showing everything)
  const displayConfig = config || {
    showBrand: true,
    showCategory: true,
    showName: true,
    showCode: true,
    showBox: true,
    showEan: true,
  };

  return (
    <>
      <div className="w-full bg-white border-[2px] border-[#3B6898] rounded-xl p-3 flex flex-col font-sans shadow-sm transition-all hover:shadow-md group h-full">
        {/* Área da Imagem */}
        <div 
          className="h-[180px] w-full flex items-center justify-center cursor-pointer overflow-hidden bg-white rounded-lg mb-3"
          onClick={() => !imgError && setLightboxOpen(true)}
        >
          {!imgError ? (
            <img
              src={thumbnailUrl}
              alt={product.name}
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
              loading={priority ? "eager" : "lazy"}
              {...(priority ? { "fetchpriority": "high" } : {})}
            />
          ) : (
            <span className="text-xl font-bold text-[#3B6898]/20">{product.name.charAt(0)}</span>
          )}
        </div>

        {/* Área de Textos Metadados */}
        <div className="flex flex-col items-center justify-center flex-grow gap-1.5 mb-3">
          {/* Marca */}
          {displayConfig.showBrand && (
            <div className="text-[#3B6898] font-bold text-[11px] uppercase tracking-widest text-center">
              {product.brand}
            </div>
          )}
          
          {/* Categoria (Mix) */}
          {displayConfig.showCategory && (
            <div className="text-[#5D82AC] font-semibold text-[10px] uppercase line-clamp-1 text-center">
              {product.category}
            </div>
          )}

          {/* Descrição do Produto */}
          {displayConfig.showName && (
            <div className="text-center text-[#3B6898] font-extrabold text-[14px] leading-[1.2] flex items-center justify-center uppercase line-clamp-3 mt-1 px-1">
              {product.name}
            </div>
          )}
        </div>

        {/* Linha Separadora Removida */}

        {/* Tabela de Dados (Estilo Pílula) */}
        <div className="flex flex-col gap-[6px] w-full">
          {/* Linha Cód */}
          {displayConfig.showCode && (
            <div className="flex text-white text-[10px] rounded-full overflow-hidden h-[22px]">
              <div className="w-[30%] bg-[#5D82AC] flex items-center justify-center font-bold border-r border-white/20">
                Cód.
              </div>
              <div className="w-[70%] bg-[#3B6898] flex items-center pl-3 font-bold text-[11px]">
                {product.code}
              </div>
            </div>
          )}

          {/* Linha Caixa */}
          {displayConfig.showBox && (
            <div className="flex text-white text-[10px] rounded-full overflow-hidden h-[22px]">
              <div className="w-[30%] bg-[#5D82AC] flex items-center justify-center font-bold border-r border-white/20">
                Caixa
              </div>
              <div className="w-[70%] bg-[#3B6898] flex items-center pl-3 font-bold text-[11px]">
                {product.packSize}
              </div>
            </div>
          )}

          {/* Linha EAN */}
          {displayConfig.showEan && (
            <div className="flex text-white text-[10px] rounded-full overflow-hidden h-[22px]">
              <div className="w-[30%] bg-[#5D82AC] flex items-center justify-center font-bold border-r border-white/20">
                EAN
              </div>
              <div className="w-[70%] bg-[#3B6898] flex items-center pl-3 font-bold text-[11px] tracking-tight">
                {product.ean}
              </div>
            </div>
          )}
        </div>
      </div>


      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 sm:p-4 flex items-center justify-center bg-black/95 border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Visualização do Produto: {product.name}</DialogTitle>
          </DialogHeader>
          <div className="w-full h-full overflow-auto flex items-center justify-center">
            <img
              src={fullImageUrl}
              alt={product.name}
              className="max-w-full max-h-[80vh] object-contain cursor-zoom-in hover:scale-150 transition-transform duration-300 origin-center"
              style={{ touchAction: "pinch-zoom" }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductCard;
