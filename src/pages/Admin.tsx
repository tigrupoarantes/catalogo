import { useState, useEffect } from "react";
import { supabaseService } from "@/services/supabaseService";
import { Product, products as initialProducts } from "@/data/products";
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

const Admin = () => {
  const { user, loading: authLoading, isAdmin } = useFirebase();
  const [products, setProducts] = useState<ProductWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithId | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    code: "",
    name: "",
    brand: "",
    category: "",
    packSize: "",
    ean: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

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
        const uploadFormData = new FormData();
        uploadFormData.append("image", imageFile);

        const uploadRes = await fetch("/api/upload-image", {
          method: "POST",
          body: uploadFormData,
        });
        const uploadJson = await uploadRes.json();
        
        if (uploadJson.status === "success") {
          imageUrl = uploadJson.imageUrl;
        } else {
          toast.error("Erro ao fazer upload da imagem");
          return;
        }
      }

      const productDataToSave = { ...formData, imageUrl };

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
    setFormData({
      code: product.code,
      name: product.name,
      brand: product.brand,
      category: product.category,
      packSize: product.packSize,
      ean: product.ean,
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
    });
    setImageFile(null);
  };

  if (authLoading || loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
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
    <div className="min-h-screen bg-muted/40">
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
                    <TableHead className="text-right text-slate-500 font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="font-semibold text-slate-800">{product.code}</TableCell>
                      <TableCell className="text-slate-700">{product.name}</TableCell>
                      <TableCell className="text-slate-700">{product.brand}</TableCell>
                      <TableCell className="text-slate-700">{product.category}</TableCell>
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
                  ))}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
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
                <h3 className="text-lg font-medium mb-2">Importar XLSX e Imagens</h3>
                <p className="text-sm text-[#474747] mb-4">
                  Selecione seu arquivo XLSX ou MD do catálogo atualizado e todas as imagens (png/jpg) que deseja enviar. 
                  O sistema usará o servidor Node para processar e atualizar o banco de dados.
                </p>
                
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    
                    const formElement = e.target as HTMLFormElement;
                    const fileInput = formElement.querySelector('#spreadsheet') as HTMLInputElement;
                    const imagesInput = formElement.querySelector('#images') as HTMLInputElement;
                    
                    if (!fileInput.files || fileInput.files.length === 0) {
                      toast.error("Por favor, selecione um arquivo XLSX ou MD.");
                      return;
                    }

                    const formData = new FormData();
                    formData.append("spreadsheet", fileInput.files[0]);
                    
                    if (imagesInput.files) {
                      for (let i = 0; i < imagesInput.files.length; i++) {
                        formData.append("images", imagesInput.files[i]);
                      }
                    }

                    setLoading(true);
                    try {
                      const res = await fetch("/api/upload", {
                        method: "POST",
                        body: formData
                      });

                      if (!res.ok) {
                        const text = await res.text();
                        try {
                          const json = JSON.parse(text);
                          toast.error(json.message || `Erro no servidor (${res.status})`);
                        } catch {
                          if (res.status === 413) {
                            toast.error("Arquivo muito grande. Tente enviar menos arquivos por vez.");
                          } else {
                            toast.error(`Erro na comunicação com servidor (${res.status})`);
                          }
                          console.error("Resposta do servidor não foi JSON:", text);
                        }
                        setLoading(false);
                        return;
                      }

                      const json = await res.json();
                      
                      if (json.status === "success") {
                        toast.info(`Upload bem-sucedido! Sincronizando ${json.processedCount} produtos com o banco...`);
                        
                        // Sincroniza com Supabase agora!
                        try {
                           await supabaseService.syncInitialData(json.products);
                           toast.success("Sincronização concluída com sucesso!");
                           // Recarrega lista
                           const data = await supabaseService.getProducts();
                           setProducts(data);
                        } catch(err) {
                           console.error(err);
                           toast.error("Processado localmente, mas erro ao salvar no Supabase.");
                        }

                        if (json.errorCount > 0) {
                          toast.error(`${json.errorCount} erros detalhados no Console F12.`);
                          console.log("Erros detalhados de mapeamento ou duplicidade de EAN:", json.errors);
                        }
                      } else {
                         toast.error(json.message || "Erro ao processar as planilhas");
                      }
                    } catch (error) {
                      toast.error("Erro na comunicação com servidor");
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
                          <p className="text-sm text-muted-foreground mt-1">Obrigatório. Arquivo (.xlsx ou .md)</p>
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
                          <p className="text-sm text-muted-foreground mt-1">Opcional. Selecione várias imagens</p>
                        </div>
                      </div>
                      <div className="relative z-10 space-y-3">
                        <Label htmlFor="images" className="sr-only">Upload de Imagens</Label>
                        <Input id="images" type="file" accept="image/png, image/jpeg" multiple className="cursor-pointer h-12 file:h-12 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 text-[#474747] bg-white border-input" />
                        <p className="text-xs text-[#474747] leading-tight">
                          Imagens com nome do Código ou EAN (ex: "789123.jpg") serão associadas automaticamente.
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
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
