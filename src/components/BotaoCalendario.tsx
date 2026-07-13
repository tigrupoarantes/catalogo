import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Event calculation helpers
function getEaster(year: number) {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

function getDiaDasMaes(year: number) {
  const date = new Date(year, 4, 1);
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }
  date.setDate(date.getDate() + 7);
  return date;
}

function getDiaDosPais(year: number) {
  const date = new Date(year, 7, 1);
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }
  date.setDate(date.getDate() + 7);
  return date;
}

function getBlackFriday(year: number) {
  const date = new Date(year, 10, 1);
  while (date.getDay() !== 4) {
    date.setDate(date.getDate() + 1);
  }
  date.setDate(date.getDate() + 21 + 1);
  return date;
}

export interface RetailEvent {
  name: string;
  date: Date;
  categories: string[];
  colorClass: string;
}

interface BotaoCalendarioProps {
  activeEvent: string | null;
  onSelectEvent: (eventName: string | null) => void;
  disabled?: boolean;
}

export default function BotaoCalendario({ activeEvent, onSelectEvent, disabled }: BotaoCalendarioProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Dynamic calculations for retail events
  const currentYear = new Date().getFullYear();
  
  const retailEvents = useMemo<RetailEvent[]>(() => {
    return [
      {
        name: "Páscoa",
        date: getEaster(currentYear),
        categories: ["Chocolate", "Vinhos de Sobremesa", "Ovos"],
        colorClass: "bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 border-yellow-300",
      },
      {
        name: "Dia das Mães",
        date: getDiaDasMaes(currentYear),
        categories: ["Chocolate", "Cereais", "Nescafé"],
        colorClass: "bg-pink-500/20 text-pink-700 hover:bg-pink-500/30 border-pink-300",
      },
      {
        name: "Dia dos Namorados",
        date: new Date(currentYear, 5, 12), // June 12
        categories: ["Vinhos", "Espumantes", "Chocolate"],
        colorClass: "bg-red-500/20 text-red-700 hover:bg-red-500/30 border-red-300",
      },
      // Julho
      {
        name: "Dia Mundial do Chocolate",
        date: new Date(currentYear, 6, 7), // July 7
        categories: ["Chocolate", "Garoto", "Nestle"],
        colorClass: "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 border-amber-300",
      },
      {
        name: "Dia Mundial do Rock",
        date: new Date(currentYear, 6, 13), // July 13
        categories: ["Nescafé", "Dolce Gusto", "Coffee", "Nespresso"],
        colorClass: "bg-zinc-500/20 text-zinc-700 hover:bg-zinc-500/30 border-zinc-300",
      },
      {
        name: "Dia Internacional da Amizade",
        date: new Date(currentYear, 6, 20), // July 20
        categories: ["Biscoitos", "Bono", "Negresco"],
        colorClass: "bg-cyan-500/20 text-cyan-700 hover:bg-cyan-500/30 border-cyan-300",
      },
      {
        name: "Dia Nacional do Escritor",
        date: new Date(currentYear, 6, 25), // July 25
        categories: ["Nescafé", "Dolce Gusto"],
        colorClass: "bg-teal-500/20 text-teal-700 hover:bg-teal-500/30 border-teal-300",
      },
      {
        name: "Dia dos Avós",
        date: new Date(currentYear, 6, 26), // July 26
        categories: ["Ninho", "Biscoitos", "Aveia"],
        colorClass: "bg-orange-500/20 text-orange-700 hover:bg-orange-500/30 border-orange-300",
      },
      // Agosto
      {
        name: "Dia Nacional do Estudante",
        date: new Date(currentYear, 7, 11), // August 11
        categories: ["Cereais", "Nescau", "Nutren"],
        colorClass: "bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30 border-indigo-300",
      },
      {
        name: "Dia dos Pais",
        date: getDiaDosPais(currentYear),
        categories: ["Whisky", "Cachaça", "Gin"],
        colorClass: "bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 border-blue-300",
      },
      {
        name: "Dia Mundial da Fotografia",
        date: new Date(currentYear, 7, 19), // August 19
        categories: ["Chocolate", "Biscoitos"],
        colorClass: "bg-violet-500/20 text-violet-700 hover:bg-violet-500/30 border-violet-300",
      },
      {
        name: "Dia do Folclore",
        date: new Date(currentYear, 7, 22), // August 22
        categories: ["Todos"],
        colorClass: "bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 border-emerald-300",
      },
      {
        name: "Dia Nacional da Educação Infantil",
        date: new Date(currentYear, 7, 25), // August 25
        categories: ["Mucilon", "Ninho", "Ninho Fases"],
        colorClass: "bg-rose-500/20 text-rose-700 hover:bg-rose-500/30 border-rose-300",
      },
      {
        name: "Dia do Psicólogo",
        date: new Date(currentYear, 7, 27), // August 27
        categories: ["Nescafé", "Dolce Gusto"],
        colorClass: "bg-sky-500/20 text-sky-700 hover:bg-sky-500/30 border-sky-300",
      },
      // Setembro
      {
        name: "Dia Nacional da Cachaça",
        date: new Date(currentYear, 8, 13), // September 13
        categories: ["Cachaça", "Gin", "Whisky"],
        colorClass: "bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 border-yellow-300",
      },
      {
        name: "Dia do Cliente",
        date: new Date(currentYear, 8, 15), // September 15
        categories: ["Todos"],
        colorClass: "bg-purple-500/20 text-purple-700 hover:bg-purple-500/30 border-purple-300",
      },
      {
        name: "Dia da Árvore",
        date: new Date(currentYear, 8, 21), // September 21
        categories: ["Todos"],
        colorClass: "bg-green-500/20 text-green-700 hover:bg-green-500/30 border-green-300",
      },
      {
        name: "Dia Internacional da Paz",
        date: new Date(currentYear, 8, 21), // September 21
        categories: ["Todos"],
        colorClass: "bg-slate-500/20 text-slate-700 hover:bg-slate-500/30 border-slate-300",
      },
      {
        name: "Dia do Contador",
        date: new Date(currentYear, 8, 22), // September 22
        categories: ["Nescafé", "Dolce Gusto"],
        colorClass: "bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30 border-indigo-300",
      },
      {
        name: "Dia Mundial do Turismo",
        date: new Date(currentYear, 8, 27), // September 27
        categories: ["Chocolate", "Biscoitos"],
        colorClass: "bg-cyan-500/20 text-cyan-700 hover:bg-cyan-500/30 border-cyan-300",
      },
      // Outubro
      {
        name: "Dia das Crianças",
        date: new Date(currentYear, 9, 12), // October 12
        categories: ["Chocolate", "Biscoitos", "Nescau", "Garoto"],
        colorClass: "bg-pink-500/20 text-pink-700 hover:bg-pink-500/30 border-pink-300",
      },
      // Novembro
      {
        name: "Black Friday",
        date: getBlackFriday(currentYear),
        categories: ["Todos", "Ofertas Prioritárias"],
        colorClass: "bg-neutral-800/20 text-neutral-800 hover:bg-neutral-800/30 border-neutral-400",
      },
      // Dezembro
      {
        name: "Natal",
        date: new Date(currentYear, 11, 25), // December 25
        categories: ["Panettone", "Vinhos", "Espumantes", "Todos"],
        colorClass: "bg-green-500/20 text-green-700 hover:bg-green-500/30 border-green-300",
      }
    ];
  }, [currentYear]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative z-10 flex items-center justify-center gap-2 rounded-xl border-[2.5px] px-5 py-2 h-11 font-black transition-all duration-150 active:scale-95 select-none w-full md:w-auto shadow-sm",
            activeEvent
              ? "bg-[#EA0086] border-[#222222] text-white hover:bg-[#c90074]"
              : "bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50 hover:border-slate-300"
          )}
          disabled={disabled}
        >
          <CalendarIcon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} />
          <span className="tracking-wide text-xs uppercase">
            {activeEvent ? activeEvent : "Calendário Sazonal"}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4 rounded-2xl shadow-xl border-slate-100 bg-white z-50">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <Gift className="h-4 w-4 text-[#EA0086]" />
            <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
              Eventos do Mix
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-1.5 max-h-80 overflow-y-auto pr-1">
            {retailEvents.map((event) => (
              <button
                key={event.name}
                type="button"
                onClick={() => {
                  onSelectEvent(event.name);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex flex-col items-start p-2 text-left rounded-lg border text-xs transition-all",
                  event.colorClass,
                  activeEvent === event.name ? "ring-2 ring-[#EA0086]" : ""
                )}
              >
                <span className="font-extrabold block truncate w-full">{event.name}</span>
                <span className="text-[9px] opacity-75">
                  {event.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
