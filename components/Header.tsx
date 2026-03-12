import React, { useState, useEffect, useMemo } from 'react';
import { APP_NAME } from '../constants.tsx';
import { Settings } from 'lucide-react';

const AppLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        className={className} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M10 50C22.5 25, 77.5 25, 90 50C77.5 75, 22.5 75, 10 50Z" stroke="#00e5ff" strokeWidth="4" strokeOpacity="0.8"/>
        <circle cx="50" cy="50" r="18" stroke="#ffffff" strokeWidth="3"/>
        <ellipse cx="50" cy="50" rx="28" ry="10" stroke="#00e5ff" strokeWidth="2.5" strokeOpacity="0.5"/>
    </svg>
);

const ZuluClock: React.FC = () => {
    const [time, setTime] = useState<string>('');

    useEffect(() => {
        const update = () => {
            const now = new Date();
            const iso = now.toISOString().replace('T', ' ').split('.')[0] + ' Z';
            setTime(iso);
        }
        update();
        const i = setInterval(update, 1000);
        return () => clearInterval(i);
    }, []);

    return (
        <div className="text-right">
            <p className="text-xs font-black text-white font-mono tracking-widest">{time}</p>
            <p className="text-[9px] text-gray-600 font-mono uppercase tracking-[0.3em]">Operational Time (UTC)</p>
        </div>
    );
}

export const Header: React.FC<{ 
    onClearSession: () => void; 
    isDemoMode: boolean; 
    onOpenInvestigations: () => void; 
    onOpenSettings: () => void;
}> = ({ onClearSession, isDemoMode, onOpenInvestigations, onOpenSettings }) => {
  
  return (
    <header className="flex items-center justify-between px-8 py-5 bg-black border-b border-white/10 z-20 shadow-2xl shrink-0">
      <div className="flex items-center">
        <AppLogo className="h-10 w-10 mr-6" />
        <div>
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-display font-black tracking-[0.2em] text-white uppercase leading-none">{APP_NAME}</h1>
            </div>
            <p className="text-[9px] text-gray-600 font-mono tracking-[0.5em] uppercase mt-1.5">Space Domain Awareness Platform</p>
        </div>
      </div>
      
      <div className="flex items-center gap-10">
          <ZuluClock />

          <div className="flex items-center gap-4">
            <button 
                onClick={onOpenSettings}
                className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-sm transition-all border border-transparent hover:border-white/10"
                title="Intelligence Configuration"
            >
                <Settings className="w-5 h-5" />
            </button>

            <button 
                onClick={onOpenInvestigations}
                className="px-6 py-2.5 text-xs font-black text-white bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 hover:border-cyan-500/50 transition-all uppercase tracking-[0.3em] font-display flex items-center gap-3 shadow-inner"
            >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                INVESTIGATIONS
            </button>
          </div>
      </div>
    </header>
  );
};
