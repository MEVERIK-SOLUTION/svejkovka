import React from 'react';
import { motion } from 'motion/react';
import { Leaf, Bird, Wind, ShieldAlert } from 'lucide-react';

interface NatureAnalysisProps {
  messages: any[];
}

export default function NatureAnalysis({ messages }: NatureAnalysisProps) {
  // Extract simple intel from messages for demo purposes
  const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
  const hasPhoto = messages.some(m => m.imageUrl);
  const hasDangerWords = lastUserMsg?.text?.toLowerCase().match(/(bláto|zima|hlad|nepřítel|pivo|vídeň)/);

  return (
    <div className="bg-[#fdfaf1] border-4 border-[#3e342a] p-4 sm:p-8 shadow-[10px_10px_0px_#3e342a] font-serif relative overflow-hidden">
      {/* Texture Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/parchment.png")' }}></div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start border-b-4 border-[#1a2f4c] pb-2 mb-6">
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Leaf className="w-8 h-8 text-[#2e4d2e]" /> Polní Zpravodaj
          </h2>
          <div className="text-right">
             <span className="block text-[8px] font-black uppercase text-[#8b0000] border border-[#8b0000] px-1">Důvěrné</span>
             <span className="block text-[10px] font-bold opacity-40">Depeše č. {messages.length + 104}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Section: Dynamic Intel */}
          <div className="space-y-4 bg-white/50 p-4 border-2 border-dashed border-[#3e342a]/20">
            <h3 className="text-lg font-black uppercase flex items-center gap-2 text-[#1a2f4c]">
              <ShieldAlert className="w-5 h-5" /> Zpravodajská Analýza
            </h3>
            {lastUserMsg ? (
              <div className="space-y-2">
                <p className="text-sm leading-relaxed italic text-[#8b0000]">
                  "Na základě hlášení: '{lastUserMsg.text?.substring(0, 40)}...'"
                </p>
                <p className="text-xs font-medium">
                  {hasDangerWords 
                    ? `Pozor! Hlášený výskyt '${hasDangerWords[0]}' v sektoru Putim signalizuje nutnost zvýšeného přídělu tabáku pro mužstvo.` 
                    : "Situace na frontě stabilní. Fauna i flóra vykazují standardní rakousko-uherskou loajalitu."}
                </p>
                {hasPhoto && (
                  <div className="mt-2 p-2 bg-[#b8974a]/10 border-l-4 border-[#b8974a] text-[10px] font-bold uppercase">
                    Fotografický důkaz byl postoupen k expertíze c.k. mapového ústavu.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs opacity-50 italic">Čekám na první hlášení ze zákopů...</p>
            )}
          </div>

          {/* Section: Flora Reference */}
          <div className="space-y-4">
            <h3 className="text-lg font-black uppercase flex items-center gap-2 text-[#2e4d2e]">
              <Wind className="w-5 h-5" /> Lokální Biotop
            </h3>
            <div className="space-y-3 text-xs sm:text-sm">
              <p>
                <span className="font-black uppercase">Aktuální Flora:</span> Dubové porosty v okolí Písku jsou v této sezóně ideální pro ukrytí celého kyrysnického pluku. 
              </p>
              <p>
                <span className="font-black uppercase">Doporučení:</span> Trhat jen byliny schválené polním lékařem. Divoký česnek u Otavy může způsobit nadměrnou bojovou kuráž.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t-2 border-[#1a2f4c]/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-[#2e4d2e] animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest opacity-60">AI Orchestrátor připraven k analýze</span>
            </div>
            <div className="text-[10px] italic font-serif">Vypracováno v.r. Švejkem</div>
        </div>
      </div>
    </div>
  );
}
