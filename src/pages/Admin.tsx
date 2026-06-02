import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { supabaseService } from "@/services/supabaseService";
import { Product, products as initialProducts, parseProductTechnicalData, serializeProductTechnicalData } from "@/data/products";
import { useFirebase } from "@/contexts/FirebaseContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, LogOut, RefreshCw, FileSpreadsheet, Images } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface ProductWithId extends Product {
  id: string;
}

interface ProductLayer {
  id: string;
  product: ProductWithId;
  scale: number;
  posX: number;
  posY: number;
  rotation: number;
  hasShadow: boolean;
}

const Admin = () => {
  const { user, loading: authLoading, isAdmin } = useFirebase();
  const [products, setProducts] = useState<ProductWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithId | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    brand: "",
    category: "",
    packSize: "",
    ean: "",
    ncm: "",
    dun: "",
    isNew: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [selectedProductForAi, setSelectedProductForAi] = useState<ProductWithId | null>(null);
  const [aiTheme, setAiTheme] = useState<string>("minimalist");
  const [aiAspectRatio, setAiAspectRatio] = useState<string>("1:1");
  const [aiCustomPrompt, setAiCustomPrompt] = useState<string>("");
  const [aiOverlayText, setAiOverlayText] = useState<string>("");
  const [aiGeneratedBgUrl, setAiGeneratedBgUrl] = useState<string>("solid-gray");
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  // Novos estados para múltiplas camadas e busca
  const [aiSearchQuery, setAiSearchQuery] = useState<string>("");
  const [productLayers, setProductLayers] = useState<ProductLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const activeLayer = productLayers.find(l => l.id === activeLayerId);

  const updateActiveLayer = (updates: Partial<ProductLayer>) => {
    if (!activeLayerId) return;
    setProductLayers(prev => prev.map(layer => layer.id === activeLayerId ? { ...layer, ...updates } : layer));
  };

  // Busca e filtro de produtos no estúdio de IA
  const filteredProductsForAi = useMemo(() => {
    if (!aiSearchQuery.trim()) return products;
    const query = aiSearchQuery.toLowerCase();
    return products.filter(p => 
      p.code.toLowerCase().includes(query) || 
      p.name.toLowerCase().includes(query) ||
      (p.brand && p.brand.toLowerCase().includes(query))
    );
  }, [products, aiSearchQuery]);

  useEffect(() => {
    if (filteredProductsForAi.length > 0) {
      if (!selectedProductForAi || !filteredProductsForAi.some(p => p.code === selectedProductForAi.code)) {
        setSelectedProductForAi(filteredProductsForAi[0]);
      }
    } else {
      setSelectedProductForAi(null);
    }
  }, [filteredProductsForAi, selectedProductForAi]);

  // Inicializa o cenário com o primeiro produto do catálogo como uma camada padrão
  useEffect(() => {
    if (products.length > 0 && productLayers.length === 0) {
      const defaultProd = products[0];
      const newLayer: ProductLayer = {
        id: "layer-" + Date.now(),
        product: defaultProd,
        scale: 80,
        posX: 0,
        posY: 0,
        rotation: 0,
        hasShadow: true,
      };
      setProductLayers([newLayer]);
      setActiveLayerId(newLayer.id);
    }
  }, [products, productLayers]);



  const handleGenerateAiBg = async () => {
    const mainProduct = selectedProductForAi || (productLayers.length > 0 ? productLayers[0].product : null);
    if (!mainProduct) {
      toast.error("Por favor, selecione ou adicione um produto primeiro.");
      return;
    }
    setIsGeneratingAi(true);
    try {
      const res = await fetch("/api/generate-ai-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productName: mainProduct.name,
          category: mainProduct.category,
          brand: mainProduct.brand,
          theme: aiTheme,
          customPrompt: aiCustomPrompt,
          aspect_ratio: aiAspectRatio
        })
      });

      if (!res.ok) {
        throw new Error(`Erro na API (${res.status})`);
      }

      const json = await res.json();
      if (json.status === "success") {
        setAiGeneratedBgUrl(json.imageUrl);
        if (json.isDemo) {
          toast.info("Chave de API do Replicate ausente no .env. Mostrando cenário premium simulado!");
        } else {
          toast.success("Cenário com IA gerado com sucesso!");
        }
      } else {
        toast.error(json.message || "Erro ao gerar cenário");
      }
    } catch (err: any) {
      console.error("AI Generate Error:", err);
      toast.error(err.message || "Falha na comunicação com o servidor de IA");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleDownloadComposite = () => {
    if (productLayers.length === 0) {
      toast.warning("Adicione pelo menos um produto ao cenário antes de baixar.");
      return;
    }
    
    toast.info("Compondo arte promocional de alta qualidade...");
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Define o tamanho baseado estritamente na proporção selecionada
    canvas.width = aiAspectRatio === "9:16" ? 1080 : 1080;
    canvas.height = aiAspectRatio === "9:16" ? 1920 : 1080;

    // Função auxiliar para carregar as imagens das camadas
    const loadLayerImage = (layer: ProductLayer): Promise<{ layer: ProductLayer; img: HTMLImageElement | null }> => {
      return new Promise((resolve) => {
        if (!layer.product.imageUrl) {
          resolve({ layer, img: null });
          return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = layer.product.imageUrl.startsWith("http") 
          ? layer.product.imageUrl 
          : window.location.origin + layer.product.imageUrl;
        img.onload = () => resolve({ layer, img });
        img.onerror = () => resolve({ layer, img: null });
      });
    };

    const drawProductsAndSave = async () => {
      try {
        const loadedLayers = await Promise.all(productLayers.map(loadLayerImage));

        // Desenha sequencialmente cada camada de produto carregada
        loadedLayers.forEach(({ layer, img }) => {
          if (!img) return;
          ctx.save();

          const baseSize = Math.min(canvas.width, canvas.height) * 0.45;
          const finalWidth = baseSize * (layer.scale / 100);
          const finalHeight = (img.naturalHeight / img.naturalWidth) * finalWidth;

          const centerX = canvas.width / 2 + (layer.posX / 100) * canvas.width;
          const centerY = canvas.height / 2 + (layer.posY / 100) * canvas.height;

          ctx.translate(centerX, centerY);
          ctx.rotate((layer.rotation * Math.PI) / 180);

          if (layer.hasShadow) {
            ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
            ctx.shadowBlur = 32;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 20;
          }

          ctx.drawImage(img, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight);
          ctx.restore();
        });

        // Desenha o slogan do banner
        if (aiOverlayText) {
          ctx.save();
          ctx.fillStyle = "white";
          ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
          ctx.lineWidth = Math.max(6, canvas.width * 0.008);
          ctx.font = `bold ${Math.round(canvas.width * 0.045)}px 'Outfit', 'Inter', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          
          const textY = canvas.height * 0.86;
          ctx.strokeText(aiOverlayText.toUpperCase(), canvas.width / 2, textY);
          ctx.fillText(aiOverlayText.toUpperCase(), canvas.width / 2, textY);
          ctx.restore();
        }

        // Faz o download da imagem finalizada
        const link = document.createElement("a");
        const nameSuffix = productLayers.map(l => l.product.code).join("-").slice(0, 30);
        link.download = `promo-${nameSuffix || "ia"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success("Arte promocional baixada com sucesso!");
      } catch (err) {
        console.error("Erro na composição final:", err);
        toast.error("Ocorreu um erro ao compor a arte final.");
      }
    };

    if (aiGeneratedBgUrl === "solid-gray") {
      // 1. Caso de Fundo Cinza Chapado
      ctx.fillStyle = "#CCCCCC";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawProductsAndSave();
    } else {
      // 2. Caso de Fundo com Imagem Gerada por IA
      const bgImg = new Image();
      bgImg.crossOrigin = "anonymous";
      bgImg.src = aiGeneratedBgUrl;
      bgImg.onload = async () => {
        // Desenha o cenário de fundo simulando "object-fit: cover" (centralizado e cortado sem distorção)
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = (bgImg.naturalWidth || 1000) / (bgImg.naturalHeight || 1000);
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let drawX = 0;
        let drawY = 0;

        if (imgRatio > canvasRatio) {
          drawWidth = canvas.height * imgRatio;
          drawX = (canvas.width - drawWidth) / 2;
        } else {
          drawHeight = canvas.width / imgRatio;
          drawY = (canvas.height - drawHeight) / 2;
        }

        ctx.drawImage(bgImg, drawX, drawY, drawWidth, drawHeight);
        drawProductsAndSave();
      };
      bgImg.onerror = () => {
        toast.error("Erro ao carregar a imagem de fundo no compositor.");
      };
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await supabaseService.getProducts();
        if (data.length === 0) {
          // If no products in Firebase, offer to sync
          setProducts([]);
        } else {
          setProducts(data);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        toast.error("Erro ao carregar produtos");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleSync = async () => {
    setLoading(true);
    try {
      await supabaseService.syncInitialData(initialProducts);
      const data = await supabaseService.getProducts();
      setProducts(data);
      toast.success("Dados sincronizados com sucesso!");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      let imageUrl = editingProduct?.imageUrl || null;

      if (imageFile) {
        try {
          imageUrl = await supabaseService.uploadProductImage(formData.code || "", imageFile);
        } catch (error) {
          toast.error("Erro ao fazer upload da imagem para o Supabase Storage");
          return;
        }
      }

      // Combine technical fields into delimited EAN string
      const combinedEan = serializeProductTechnicalData(formData.ean, formData.ncm, formData.dun, formData.isNew);

      const productDataToSave = {
        code: formData.code,
        name: formData.name,
        brand: formData.brand,
        category: formData.category,
        packSize: formData.packSize,
        ean: combinedEan,
        imageUrl
      };

      if (editingProduct) {
        await supabaseService.updateProduct(editingProduct.id, productDataToSave);
        toast.success("Produto atualizado");
      } else {
        await supabaseService.addProduct(productDataToSave as Product);
        toast.success("Produto adicionado");
      }
      const data = await supabaseService.getProducts();
      setProducts(data);
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Erro ao salvar produto");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      try {
        await supabaseService.deleteProduct(id);
        setProducts(prev => prev.filter((p: ProductWithId) => p.id !== id));
        toast.success("Produto excluído");
      } catch (error) {
        toast.error("Erro ao excluir produto");
      }
    }
  };

  const openEdit = (product: ProductWithId) => {
    setEditingProduct(product);
    const techData = parseProductTechnicalData(product);
    setFormData({
      code: product.code,
      name: product.name,
      brand: product.brand,
      category: product.category,
      packSize: product.packSize || "",
      ean: techData.ean,
      ncm: techData.ncm,
      dun: techData.dun,
      isNew: !!product.isNew,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      code: "",
      name: "",
      brand: "",
      category: "",
      packSize: "",
      ean: "",
      ncm: "",
      dun: "",
      isNew: false,
    });
    setImageFile(null);
  };

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#FAFCFF]">
        <div className="relative flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100/50">
          <img src="/loading.gif" alt="Carregando..." className="w-16 h-16 object-contain" />
          <span className="mt-4 text-slate-600 font-extrabold text-xs uppercase tracking-[0.2em] animate-pulse">Carregando...</span>
        </div>
      </div>
    );
  }

  // if (!isAdmin) {
  //   return (
  //     <div className="flex flex-col items-center justify-center h-screen space-y-4">
  //       <h1 className="text-xl font-bold">Acesso Negado</h1>
  //       <p>Você não tem permissão para acessar esta área.</p>
  //       <Button onClick={() => auth.signOut()}>Sair</Button>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-primary py-4 px-6 text-white shadow-md flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Painel Administrativo</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate("/")}>Ver Site</Button>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => auth.signOut()}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
            <TabsTrigger value="estudio-ia">
              Estúdio de IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Gerenciar Produtos</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSync} title="Adiciona produtos do arquivo estático que ainda não estão no Firebase">
                  <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar Novos
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" /> Novo Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
                      <DialogDescription>
                        Preencha os detalhes do produto abaixo.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="code" className="text-right">Código</Label>
                        <Input id="code" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Nome</Label>
                        <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="brand" className="text-right">Marca</Label>
                        <Input id="brand" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">Categoria</Label>
                        <Input id="category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="packSize" className="text-right">Embalagem</Label>
                        <Input id="packSize" value={formData.packSize} onChange={e => setFormData({...formData, packSize: e.target.value})} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="ean" className="text-right">EAN</Label>
                        <Input id="ean" value={formData.ean} onChange={e => setFormData({...formData, ean: e.target.value})} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="ncm" className="text-right">Class. Fiscal</Label>
                        <Input id="ncm" value={formData.ncm} onChange={e => setFormData({...formData, ncm: e.target.value})} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dun" className="text-right">DUN</Label>
                        <Input id="dun" value={formData.dun} onChange={e => setFormData({...formData, dun: e.target.value})} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="image" className="text-right">Imagem</Label>
                        <Input 
                          id="image" 
                          type="file" 
                          accept="image/png, image/jpeg" 
                          onChange={e => {
                            if (e.target.files && e.target.files.length > 0) {
                              setImageFile(e.target.files[0]);
                            }
                          }} 
                          className="col-span-3" 
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="isNew" className="text-right">Lançamento</Label>
                        <div className="col-span-3 flex items-center">
                          <input 
                            id="isNew" 
                            type="checkbox" 
                            checked={formData.isNew} 
                            onChange={e => setFormData({...formData, isNew: e.target.checked})}
                            className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                          />
                          <span className="ml-2.5 text-sm text-slate-500 font-medium select-none cursor-pointer" onClick={() => setFormData({...formData, isNew: !formData.isNew})}>
                            Este produto é um lançamento ("NOVO")
                          </span>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleSave}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="bg-white rounded-lg border shadow-sm text-slate-900">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableHead className="text-slate-500 font-bold">Código</TableHead>
                    <TableHead className="text-slate-500 font-bold">Nome</TableHead>
                    <TableHead className="text-slate-500 font-bold">Marca</TableHead>
                    <TableHead className="text-slate-500 font-bold">Categoria</TableHead>
                    <TableHead className="text-slate-500 font-bold">Class. Fiscal</TableHead>
                    <TableHead className="text-slate-500 font-bold">DUN</TableHead>
                    <TableHead className="text-right text-slate-500 font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const techData = parseProductTechnicalData(product);
                    return (
                      <TableRow key={product.id} className="border-slate-100 hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            {product.code}
                            {product.isNew && (
                              <span className="bg-[#426EA8]/10 text-[#426EA8] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                Novo
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">{product.name}</TableCell>
                        <TableCell className="text-slate-700">{product.brand}</TableCell>
                        <TableCell className="text-slate-700">{product.category}</TableCell>
                        <TableCell className="text-slate-700">{techData.ncm || "-"}</TableCell>
                        <TableCell className="text-slate-700">{techData.dun || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900 hover:bg-slate-100" onClick={() => openEdit(product)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(product.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        Nenhum produto cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Upload de Catálogo em Lote</h2>
            </div>

            <div className="bg-white rounded-lg border shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Importar XLSX e Imagens em Lote</h3>
                <p className="text-sm text-[#474747] mb-4">
                  Selecione sua planilha (.xlsx/.md) do catálogo e/ou envie imagens em lote. As imagens são processadas e vinculadas de forma automática, sendo salvas diretamente na nuvem (Supabase Storage) para acesso persistente e seguro.
                </p>
                
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    
                    const formElement = e.target as HTMLFormElement;
                    const fileInput = formElement.querySelector('#spreadsheet') as HTMLInputElement;
                    const imagesInput = formElement.querySelector('#images') as HTMLInputElement;
                    
                    const hasSpreadsheet = fileInput.files && fileInput.files.length > 0;
                    const hasImages = imagesInput.files && imagesInput.files.length > 0;

                    if (!hasSpreadsheet && !hasImages) {
                      toast.error("Por favor, selecione uma planilha XLSX/MD ou envie imagens em lote.");
                      return;
                    }

                    setLoading(true);
                    try {
                      let parsedProducts: any[] = [];
                      let isSpreadsheetUpload = false;

                      if (hasSpreadsheet) {
                        isSpreadsheetUpload = true;
                        // Post spreadsheet to parse it on backend
                        const uploadFormData = new FormData();
                        uploadFormData.append("spreadsheet", fileInput.files[0]);
                        
                        const res = await fetch("/api/upload", {
                          method: "POST",
                          body: uploadFormData
                        });

                        if (!res.ok) {
                          const text = await res.text();
                          try {
                            const json = JSON.parse(text);
                            toast.error(json.message || `Erro no servidor (${res.status})`);
                          } catch {
                            toast.error(`Erro na comunicação com o servidor (${res.status})`);
                          }
                          setLoading(false);
                          return;
                        }

                        const json = await res.json();
                        if (json.status === "success") {
                          parsedProducts = json.products;
                        } else {
                          toast.error(json.message || "Erro ao processar a planilha");
                          setLoading(false);
                          return;
                        }
                      } else {
                        // If no spreadsheet, use current registered products list
                        parsedProducts = [...products];
                      }

                      // Image-only batch matching & direct Supabase upload in frontend
                      const matchedCodes = new Set<string>();
                      const unmatchedImages: string[] = [];
                      const finalProducts = [...parsedProducts];

                      const extractCodeFromFilename = (filename: string): string => {
                        const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
                        if (nameWithoutExt.includes(" - ")) {
                          return nameWithoutExt.split(" - ")[0].trim();
                        }
                        const match = nameWithoutExt.match(/^([a-zA-Z0-9]+)/);
                        return match ? match[1].trim() : nameWithoutExt.trim();
                      };

                      if (hasImages && imagesInput.files) {
                        toast.info(`Processando e fazendo upload de ${imagesInput.files.length} imagem(ns) diretamente para o Supabase Storage...`);
                        
                        for (let i = 0; i < imagesInput.files.length; i++) {
                          const file = imagesInput.files[i];
                          const extractedCode = extractCodeFromFilename(file.name);
                          
                          // Find match
                          const productIdx = finalProducts.findIndex(
                            p => String(p.code).trim().toLowerCase() === extractedCode.toLowerCase()
                          );

                          if (productIdx !== -1) {
                            const product = finalProducts[productIdx];
                            try {
                              // Upload directly to Supabase Storage
                              const publicUrl = await supabaseService.uploadProductImage(product.code, file);
                              finalProducts[productIdx] = {
                                ...product,
                                imageUrl: publicUrl
                              };
                              matchedCodes.add(product.code);
                            } catch (uploadErr) {
                              console.error(`Erro no upload da imagem ${file.name}:`, uploadErr);
                              unmatchedImages.push(`${file.name} (Erro de upload)`);
                            }
                          } else {
                            unmatchedImages.push(file.name);
                          }
                        }
                      }

                      // Synchronize products to Supabase
                      toast.info("Sincronizando dados no banco...");
                      await supabaseService.syncInitialData(finalProducts);

                      // Summary toast feedback
                      if (isSpreadsheetUpload) {
                        toast.success(`Planilha processada! ${finalProducts.length} produtos importados. ${matchedCodes.size} imagens vinculadas.`);
                      } else {
                        toast.success(`${matchedCodes.size} imagem(ns) vinculada(s) com sucesso, ${unmatchedImages.length} imagem(ns) ignorada(s) (código não encontrado).`);
                      }

                      if (unmatchedImages.length > 0) {
                        toast.warning(`Algumas imagens não foram vinculadas. Veja a aba Console F12 para a lista de nomes ignorados.`, { duration: 10000 });
                        console.warn("Imagens ignoradas (não vinculadas a produtos):", unmatchedImages);
                      }

                      // Recarrega lista
                      const data = await supabaseService.getProducts();
                      setProducts(data);

                    } catch (error: any) {
                      console.error("Batch processing error:", error);
                      toast.error("Erro na comunicação ou processamento: " + (error.message || "Erro desconhecido"));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-border/50 rounded-xl p-6 bg-card text-card-foreground shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="relative z-10 flex items-start gap-4 mb-5">
                        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 shadow-inner">
                          <FileSpreadsheet className="h-6 w-6 text-primary" />
                        </div>
                        <div className="pt-1">
                          <h4 className="font-semibold text-base">1. Planilha de Dados</h4>
                          <p className="text-sm text-muted-foreground mt-1">Opcional. Arquivo (.xlsx ou .md)</p>
                        </div>
                      </div>
                      <div className="relative z-10">
                        <Label htmlFor="spreadsheet" className="sr-only">Upload de Planilha</Label>
                        <Input id="spreadsheet" type="file" accept=".xlsx,.xls,.md" className="cursor-pointer h-12 file:h-12 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 text-[#474747] bg-white border-input" />
                      </div>
                    </div>
                    
                    <div className="border border-border/50 rounded-xl p-6 bg-card text-card-foreground shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="relative z-10 flex items-start gap-4 mb-5">
                        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 shadow-inner">
                          <Images className="h-6 w-6 text-primary" />
                        </div>
                        <div className="pt-1">
                          <h4 className="font-semibold text-base">2. Imagens em Lote</h4>
                          <p className="text-sm text-muted-foreground mt-1">Selecione várias imagens para vincular</p>
                        </div>
                      </div>
                      <div className="relative z-10 space-y-3">
                        <Label htmlFor="images" className="sr-only">Upload de Imagens</Label>
                        <Input id="images" type="file" accept="image/png, image/jpeg" multiple className="cursor-pointer h-12 file:h-12 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 text-[#474747] bg-white border-input" />
                        <p className="text-xs text-[#474747] leading-tight">
                          Nome esperado: [CÓDIGO] - [NOME].ext (ex: "418897 - TOSTINES.png"). Vinculação automática inteligente.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={loading}>
                    {loading ? "Processando..." : "Enviar Arquivos"}
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="estudio-ia" className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
              <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Estúdio de Imagens com IA</h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">
                    Crie cenários publicitários e banners promocionais realistas para os seus produtos em segundos.
                  </p>
                </div>
                
                {/* Status Indicator */}
                <div className="inline-flex items-center gap-2 p-2 px-3 bg-sky-50 border border-sky-100 rounded-full shrink-0 text-sky-800 text-[11px] font-bold">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    className="animate-spin text-sky-600"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Motor Integrado de Composições FLUX.1
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Coluna da Esquerda: Configuração */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Seletor de Produto */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">Produto Comercial do Catálogo</label>
                    <div className="relative">
                       <Input 
                         placeholder="Buscar produto por nome ou código..." 
                         value={aiSearchQuery} 
                         onChange={(e) => setAiSearchQuery(e.target.value)}
                         className="h-11 rounded-xl text-slate-700 font-bold border-slate-200 bg-white w-full"
                       />
                     </div>

                      <div className="grid grid-cols-[minmax(0,_1.7fr)_minmax(0,_1.3fr)] gap-2 mt-2 w-full">
                        <div className="min-w-0">
                          <select 
                            value={selectedProductForAi?.code || ""} 
                            onChange={(e) => {
                              const prod = products.find(p => p.code === e.target.value);
                              if (prod) setSelectedProductForAi(prod);
                            }}
                            className="w-full h-11 px-3 border border-slate-200 rounded-xl font-bold text-slate-700 bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer min-w-0 text-xs sm:text-sm"
                          >
                            {filteredProductsForAi.length === 0 ? (
                              <option value="">Nenhum produto encontrado</option>
                            ) : (
                              filteredProductsForAi.map((p) => (
                                <option key={p.code} value={p.code}>
                                  {p.code} - {p.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                        
                        <div className="min-w-0">
                          <Button 
                            type="button"
                            onClick={() => {
                              if (selectedProductForAi) {
                                const newLayer: ProductLayer = {
                                  id: "layer-" + Date.now() + Math.random().toString(36).substr(2, 4),
                                  product: selectedProductForAi,
                                  scale: 60,
                                  posX: Math.floor(Math.random() * 20) - 10,
                                  posY: Math.floor(Math.random() * 20) - 10,
                                  rotation: 0,
                                  hasShadow: true,
                                };
                                setProductLayers(prev => [...prev, newLayer]);
                                setActiveLayerId(newLayer.id);
                                toast.success("Produto adicionado ao cenário!");
                              }
                            }}
                            className="h-11 bg-slate-900 hover:bg-black text-white rounded-xl font-bold px-3 shrink-0 shadow-sm active:scale-95 transition-all text-xs truncate w-full"
                            disabled={!selectedProductForAi}
                          >
                            Adicionar ao Cenário
                          </Button>
                        </div>
                      </div>

                    {selectedProductForAi && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl mt-2 select-none">
                        <div className="h-12 w-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-sm">
                          {selectedProductForAi.imageUrl ? (
                            <img src={selectedProductForAi.imageUrl} alt={selectedProductForAi.name} className="h-full w-full object-contain" />
                          ) : (
                            <div className="text-[10px] text-slate-400 font-black">Sem Foto</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-800 truncate leading-tight">{selectedProductForAi.name}</h4>
                          <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">{selectedProductForAi.brand || "Nestlé"} • {selectedProductForAi.category || "Chocolate"}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lista de Produtos Adicionados (Camadas) */}
                  <div className="space-y-2 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl select-none">
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Produtos no Cenário ({productLayers.length})</h4>
                    {productLayers.length === 0 ? (
                      <p className="text-xs text-slate-400 font-semibold italic text-center py-2">Nenhum produto adicionado ao cenário.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                        {productLayers.map((layer) => (
                          <div 
                            key={layer.id}
                            onClick={() => setActiveLayerId(layer.id)}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer",
                              activeLayerId === layer.id 
                                ? "bg-slate-900 text-white border-transparent shadow-md" 
                                : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded bg-white border border-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-sm">
                                {layer.product.imageUrl ? (
                                  <img src={layer.product.imageUrl} alt={layer.product.name} className="h-full w-full object-contain" />
                                ) : (
                                  <div className="text-[8px] text-slate-400 font-black">Sem Foto</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[10px] truncate leading-tight">{layer.product.name}</p>
                                <p className={cn("text-[8px] font-semibold mt-0.5 truncate", activeLayerId === layer.id ? "text-slate-400" : "text-slate-500")}>Cód: {layer.product.code}</p>
                              </div>
                            </div>
                            
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProductLayers(prev => prev.filter(l => l.id !== layer.id));
                                if (activeLayerId === layer.id) {
                                  const remaining = productLayers.filter(l => l.id !== layer.id);
                                  setActiveLayerId(remaining.length > 0 ? remaining[0].id : null);
                                }
                                toast.success("Produto removido do cenário.");
                              }}
                              className={cn(
                                "h-7 w-7 rounded-lg shrink-0",
                                activeLayerId === layer.id 
                                  ? "text-red-400 hover:text-red-500 hover:bg-slate-800" 
                                  : "text-slate-400 hover:text-red-500 hover:bg-slate-50"
                              )}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Proporção */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">Proporção da Imagem Promocional</label>
                    <div className="flex gap-3">
                      {[
                        { id: "1:1", label: "1:1 Quadrado", desc: "WhatsApp e Feed Social", widthClass: "aspect-square h-5 w-5" },
                        { id: "9:16", label: "9:16 Vertical", desc: "Stories e Reels", widthClass: "aspect-[9/16] h-5 w-3" }
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setAiAspectRatio(f.id)}
                          className={cn(
                            "flex-1 p-3 rounded-xl border text-left flex items-center gap-3 transition-all duration-200 select-none shadow-sm active:scale-[0.98]",
                            aiAspectRatio === f.id 
                              ? "bg-slate-900 border-transparent text-white" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className={cn("rounded border shrink-0 bg-transparent flex items-center justify-center p-0.5", aiAspectRatio === f.id ? "border-white/30" : "border-slate-300")}>
                            <div className={cn("rounded-sm", f.widthClass, aiAspectRatio === f.id ? "bg-white/40" : "bg-slate-100")} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-xs uppercase tracking-wide leading-tight">{f.label}</h4>
                            <p className={cn("text-[9px] mt-0.5 font-semibold leading-tight truncate", aiAspectRatio === f.id ? "text-slate-300" : "text-slate-400")}>{f.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sliders de Posição */}
                  <div className="space-y-3 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl select-none">
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Ajuste de Composição (Arrastar & Escalar)</h4>
                    
                    {!activeLayer ? (
                      <div className="py-4 text-center">
                        <p className="text-xs text-slate-400 font-bold italic leading-relaxed">
                          ⚠️ Selecione um produto na lista de camadas acima para calibrar sua posição e tamanho no cenário.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="p-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold text-center truncate mb-1">
                          Ajustando: {activeLayer.product.name}
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-600">
                            <span>Tamanho da Embalagem</span>
                            <span>{activeLayer.scale}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="20" 
                            max="150" 
                            value={activeLayer.scale} 
                            onChange={(e) => updateActiveLayer({ scale: Number(e.target.value) })} 
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span>Posição X</span>
                              <span>{activeLayer.posX > 0 ? `+${activeLayer.posX}` : activeLayer.posX}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="-50" 
                              max="50" 
                              value={activeLayer.posX} 
                              onChange={(e) => updateActiveLayer({ posX: Number(e.target.value) })} 
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span>Posição Y</span>
                              <span>{activeLayer.posY > 0 ? `+${activeLayer.posY}` : activeLayer.posY}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="-50" 
                              max="50" 
                              value={activeLayer.posY} 
                              onChange={(e) => updateActiveLayer({ posY: Number(e.target.value) })} 
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-600">
                            <span>Rotação do Produto</span>
                            <span>{activeLayer.rotation}°</span>
                          </div>
                          <input 
                            type="range" 
                            min="-180" 
                            max="180" 
                            value={activeLayer.rotation} 
                            onChange={(e) => updateActiveLayer({ rotation: Number(e.target.value) })} 
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                          />
                        </div>

                        <div className="flex items-center pt-2">
                          <input 
                            id="aiHasShadow" 
                            type="checkbox" 
                            checked={activeLayer.hasShadow} 
                            onChange={(e) => updateActiveLayer({ hasShadow: e.target.checked })}
                            className="h-4.5 w-4.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                          <label htmlFor="aiHasShadow" className="ml-2 text-xs text-slate-700 font-bold select-none cursor-pointer">
                            Habilitar sombra 3D projetada realística
                          </label>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Texto da Arte */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">Slogan/Texto da Arte (Opcional)</label>
                    <Input 
                      placeholder="Ex: NOVO!, LANÇAMENTO!, MÃES NESTLÉ" 
                      value={aiOverlayText} 
                      onChange={(e) => setAiOverlayText(e.target.value)}
                      className="h-11 rounded-xl text-slate-700 font-bold border-slate-200 bg-white"
                    />
                  </div>

                  {/* Custom Prompt */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">Instrução de Ambientação Extras para a IA</label>
                    <Textarea 
                      placeholder="Ex: com morangos frescos ao lado na mesa de mármore, iluminação solar suave, foco raso..." 
                      value={aiCustomPrompt} 
                      onChange={(e) => setAiCustomPrompt(e.target.value)}
                      className="rounded-xl text-slate-600 border-slate-200 bg-white h-20 min-h-20 max-h-20"
                    />
                  </div>

                  {/* Ação Principal: Gerar Cenário */}
                  <Button 
                    type="button" 
                    onClick={handleGenerateAiBg}
                    className="w-full gap-2 bg-[#426EA8] hover:bg-[#345889] text-white rounded-xl h-12 font-bold transition-all shadow-md active:scale-95"
                    disabled={isGeneratingAi}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="18" 
                      height="18" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      className="animate-pulse"
                    >
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                      <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" opacity="0.7" />
                    </svg>
                    {isGeneratingAi ? "Gereando Cenário por IA..." : "Gerar Cenário Promocional"}
                  </Button>

                </div>

                {/* Coluna da Direita: Visualizador e Compositor */}
                <div className="lg:col-span-7 space-y-5">
                  <h3 className="text-sm font-black text-slate-600 uppercase tracking-wider block">Visualizador de Arte Final</h3>
                  
                  {/* Wrapper para Centralização Perfeita sem Esticar */}
                  <div className="flex justify-center items-center bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.02)] min-h-[350px]">
                    {/* Container Principal do Compositor */}
                    <div className={cn("relative overflow-hidden w-full shadow-lg flex items-center justify-center select-none shadow-[0_12px_45px_rgba(0,0,0,0.06)] border border-slate-100/40 rounded-xl bg-slate-900", 
                      aiAspectRatio === "9:16" ? "max-w-[270px] aspect-[9/16]" : "max-w-full aspect-square"
                    )}>
                      
                      {/* Camada 1: Cenário (AI Background) */}
                      {aiGeneratedBgUrl === "solid-gray" ? (
                        <div className="absolute inset-0 w-full h-full bg-[#CCCCCC]" />
                      ) : (
                        <img 
                          src={aiGeneratedBgUrl} 
                          alt="Cenário de Fundo" 
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
                        />
                      )}
                      
                      {/* Camada 2: Embalagens dos Produtos com transformações responsivas e sombra suave */}
                      {productLayers.map((layer) => (
                        <div 
                          key={layer.id}
                          onClick={() => setActiveLayerId(layer.id)}
                          className={cn(
                            "absolute cursor-pointer transition-all duration-75 flex items-center justify-center group",
                            activeLayerId === layer.id 
                              ? "ring-2 ring-sky-400 ring-offset-1 rounded-xl p-1 z-10" 
                              : "hover:ring-1 hover:ring-slate-300 rounded-xl p-1 z-5"
                          )}
                          style={{
                            top: `calc(50% + ${layer.posY}%)`,
                            left: `calc(50% + ${layer.posX}%)`,
                            transform: `translate(-50%, -50%) scale(${layer.scale / 100}) rotate(${layer.rotation}deg)`,
                            maxHeight: '75%',
                            maxWidth: '75%'
                          }}
                        >
                          {layer.product.imageUrl ? (
                            <img 
                              src={layer.product.imageUrl} 
                              alt={layer.product.name} 
                              className="object-contain pointer-events-none"
                              style={{
                                maxHeight: '100%',
                                maxWidth: '100%',
                                filter: layer.hasShadow ? 'drop-shadow(0 25px 35px rgba(0,0,0,0.45)) drop-shadow(0 10px 10px rgba(0,0,0,0.2))' : 'none'
                              }}
                            />
                          ) : (
                            <div className="p-4 bg-white/90 backdrop-blur border rounded-xl text-slate-400 font-bold text-xs uppercase shadow-md select-none">
                              Sem Foto do Produto
                            </div>
                          )}

                          {/* Etiqueta pequena do produto ativa no hover */}
                          <div className="absolute -top-6 bg-slate-950/80 backdrop-blur-sm text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {layer.product.code}
                          </div>
                        </div>
                      ))}

                      {/* Camada 3: Slogan/Texto sobreposto */}
                      {aiOverlayText && (
                        <div className="absolute bottom-[10%] left-0 right-0 text-center pointer-events-none px-4">
                          <span 
                            className="text-white font-black uppercase text-xl sm:text-2xl md:text-3xl tracking-wider select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]"
                            style={{ fontFamily: "'Outfit', 'Inter', sans-serif" }}
                          >
                            {aiOverlayText}
                          </span>
                        </div>
                      )}

                      {/* Camada 4: Loader com Spinner Customizado do Cliente */}
                      {isGeneratingAi && (
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center text-center animate-fade-in z-20">
                          <div className="relative flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-[260px]">
                            <img src="/loading.gif" alt="Gerando..." className="w-14 h-14 object-contain" />
                            <h4 className="mt-4 font-black text-xs text-slate-800 uppercase tracking-wider animate-pulse">Desenhando Cenário</h4>
                            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-1">Conectando ao motor neural FLUX para renderizar em alta fidelidade...</p>
                          </div>
                        </div>
                      )}

                      {/* Dica discreta */}
                      <div className="absolute top-4 left-4 bg-slate-950/70 backdrop-blur-sm text-white/90 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider select-none">
                        Estúdio Compositor Visual v1.0
                      </div>

                    </div>
                  </div>

                  {/* Ações Finais da Arte */}
                  <div className="flex gap-4">
                    <Button 
                      type="button" 
                      onClick={handleDownloadComposite}
                      className="flex-1 gap-2 bg-[#242525] hover:bg-[#101111] text-white rounded-xl h-12 font-bold shadow-md transition-all active:scale-[0.98]"
                      disabled={isGeneratingAi || productLayers.length === 0}
                    >
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
                        className="shrink-0"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" x2="12" y1="15" y2="3"/>
                      </svg>
                      Baixar Arte Promocional (PNG)
                    </Button>
                  </div>
                  {/* Nota informativa sobre a Chave de IA */}
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-[11px] text-slate-600 font-medium leading-relaxed">
                    💡 **Dica de Produção**: O Estúdio está rodando no **Modo Compositor Inteligente**. Para liberar a geração de cenários customizados e novos por Inteligência Artificial ilimitada via FLUX.1, configure a chave `REPLICATE_API_TOKEN` no arquivo `.env` da raiz do seu servidor!
                  </div>

                </div>

              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
