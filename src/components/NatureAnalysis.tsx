import React from 'react';
import { motion } from 'motion/react';
import { Leaf, Bird, Wind, ShieldAlert } from 'lucide-react';

export default function NatureAnalysis() {
  return (
    <div className="bg-[#fdfaf1] border-4 border-[#3e342a] p-4 sm:p-8 shadow-[10px_10px_0px_#3e342a] font-serif relative overflow-hidden">
      {/* Texture Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/parchment.png")' }}></div>
      
      <div className="relative z-10">
        <h2 className="text-2xl font-black uppercase tracking-tighter border-b-4 border-[#1a2f4c] pb-2 mb-6 flex items-center gap-3">
          <Leaf className="w-8 h-8 text-[#2e4d2e]" /> Polní příručka: Fauna a Flóra
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Section: Flora */}
          <div className="space-y-4">
            <h3 className="text-lg font-black uppercase flex items-center gap-2 text-[#2e4d2e]">
              <Wind className="w-5 h-5" /> Rostlinstvo a Terén
            </h3>
            <p className="text-sm leading-relaxed italic">
              "Kolem Písku a Putimi se rozkládají hluboké smíšené lesy, kde duby a buky pamatují ještě slavné časy maršála Radeckého."
            </p>
            <div className="space-y-3 text-xs sm:text-sm">
              <div className="bg-[#2e4d2e]/5 p-3 border-l-4 border-[#2e4d2e]">
                <span className="font-black uppercase block mb-1">Využití v ARMÁDĚ:</span>
                Mladé smrkové větve sloužily jako improvizované maskování (Tarnung) pro dělostřelectvo. Borové jehličí tlumilo zvuk mašírujících bot při nočních přesunech.
              </div>
              <p>
                <span className="font-black uppercase">Vliv na pochod:</span> Jarní bláto v jihočeských úvalech dokázalo zastavit i ty nejzdatnější rekruty. Husté maliní a kopřivy u břehů Otavy tvořily přirozené překážky, které často nutily důstojníky přehodnotit trasu postupu.
              </p>
            </div>
          </div>

          {/* Section: Fauna */}
          <div className="space-y-4">
            <h3 className="text-lg font-black uppercase flex items-center gap-2 text-[#8b4513]">
              <Bird className="w-5 h-5" /> Zvířectvo v poli
            </h3>
            <p className="text-sm leading-relaxed italic">
              "Jihočeský kapr je sice dobrý, ale zajíc v poli, to je teprve ta pravá vojenská strategická surovina."
            </p>
            <div className="space-y-3 text-xs sm:text-sm">
               <div className="bg-[#8b4513]/5 p-3 border-l-4 border-[#8b4513]">
                  <span className="font-black uppercase block mb-1">Kulturní význam:</span>
                  Koroptev polní byla symbolem hojnosti, zatímco potulní psi (často prodávaní panem Švejkem jako raritní rasy) provázeli pluky jako neoficiální maskoti a ohřívače v zákopech.
               </div>
               <p>
                 <span className="font-black uppercase">Bojový vliv:</span> Koně byli páteří logistiky. Jejich krmení (oves) bylo strategicky důležitější než tabák pro mužstvo. Výskyt divokých prasat v lesích kolem Putimi nutil hlídky k ostražitosti i mimo přímé bojové ohrožení.
               </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t-2 border-dashed border-[#1a2f4c]/20">
           <div className="flex items-start gap-4">
              <ShieldAlert className="w-10 h-10 text-[#8b0000] shrink-0" />
              <div>
                <h4 className="font-black uppercase text-sm mb-1">Analýza Generálního štábu (v.r. 1914)</h4>
                <p className="text-xs leading-tight opacity-70">
                  Přírodní prvky regionu jsou faktorem, který nelze opomenout. Každý strom může být úkrytem, každá mokřina zdržením. Doporučuje se mužstvu dbát na čistotu onucí, neboť jihočeská flóra v kombinaci s potem vytváří ideální podmínky pro vznik pochodové gangrény.
                </p>
              </div>
           </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-[-10px] right-[-10px] opacity-10">
           <Leaf className="w-32 h-32 rotate-12" />
        </div>
      </div>
    </div>
  );
}
