import { supabase } from '../integrations/supabase/client';
import { Product } from '../data/products';

const PRODUCTS_TABLE = 'products_v2';

export const supabaseService = {
  async getProducts(): Promise<(Product & { id: string })[]> {
    const { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .select('*');
      
    if (error) {
      console.error("Error fetching from Supabase:", error);
      throw error;
    }
    return data as (Product & { id: string })[];
  },

  async addProduct(product: Omit<Product, 'id'>) {
    const productWithId = {
      ...product,
      id: product.code // Use code as primary key ID
    };
    const { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .insert([productWithId])
      .select()
      .single();
      
    if (error) {
       console.error("Error adding product:", error);
       throw error;
    }
    return data;
  },

  async updateProduct(id: string, product: Partial<Product>) {
    const { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .update(product)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error("Error updating product:", error);
      throw error;
    }
    return data;
  },

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from(PRODUCTS_TABLE)
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
    return true;
  },

  async syncInitialData(initialProducts: Product[]) {
    console.log(`Checking ${initialProducts.length} products to sync...`);
    
    // Fetch all existing products to map by code
    const { data: existingData, error: fetchError } = await supabase
      .from(PRODUCTS_TABLE)
      .select('*');
      
    if (fetchError) {
      console.error("Error fetching existing products:", fetchError);
      throw fetchError;
    }

    const existingProductsMap = new Map<string, any>();
    (existingData || []).forEach(doc => {
      existingProductsMap.set(doc.code, doc);
    });

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    for (const product of initialProducts) {
      const existing = existingProductsMap.get(product.code);
      
      if (!existing) {
        toInsert.push(product);
      } else {
        const updatedImageUrl = product.imageUrl || existing.imageUrl;
        toUpdate.push({
          ...product,
          id: existing.id,
          imageUrl: updatedImageUrl
        });
      }
    }

    // Process Inserts
    if (toInsert.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const chunk = toInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from(PRODUCTS_TABLE).insert(chunk);
        if (error) {
          console.error("Error inserting chunk:", error);
          throw error;
        }
      }
    }

    // Process Updates (Supabase upsert by ID)
    if (toUpdate.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const chunk = toUpdate.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from(PRODUCTS_TABLE).upsert(chunk);
        if (error) {
          console.error("Error updating chunk:", error);
          throw error;
        }
      }
    }

    console.log('Sync complete.');
  },

  async uploadProductImage(code: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${code}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        upsert: true,
        cacheControl: '3600',
      });
      
    if (error) {
      console.error("Error uploading image to Supabase:", error);
      throw error;
    }
    
    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);
      
    return publicUrlData.publicUrl;
  }
};
