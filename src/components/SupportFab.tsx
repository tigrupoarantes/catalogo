import { useState } from "react";
import { MessageCircleQuestion, X } from "lucide-react";

const WHATSAPP_URL = "https://api.whatsapp.com/send?phone=5516992216542&text=Ol%C3%A1%2C%20gostaria%20de%20suporte.";

const SupportFab = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-72 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 relative">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
          <p className="text-sm leading-relaxed pr-4 text-primary">
            Melhorias, sugestão ou suporte: entre em contato pelo WhatsApp{" "}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold underline underline-offset-2 hover:text-primary/80"
            >
              +55 16 99221-6542
            </a>
            . Ao enviar mensagem, abra o chamado para o <strong>Marketing (Opção 4)</strong>.
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-[#242525] text-[#FFFFFF] border border-[#242525] rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-[#FFFFFF] hover:text-[#242525] transition-all duration-300"
        aria-label="Suporte"
      >
        <MessageCircleQuestion size={24} />
      </button>
    </div>
  );
};

export default SupportFab;
