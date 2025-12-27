import React, { useMemo } from 'react';
import { AnomalyAlert } from '../types';
import { RiskLevel } from '../constants';

interface GlobalStatsBarProps {
    alerts: AnomalyAlert[];
    satelliteCount: number;
    lastSyncTime: number;
    isSyncing: boolean;
    onSync: () => void;
}

const TacticalStatTooltip = ({ title, content, footer }: { title: string; content: string; footer?: string }) => (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 p-4 bg-black border border-white/20 rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-[200] backdrop-blur-3xl ring-1 ring-white/10 text-left">
        <div className="font-bold text-white uppercase tracking-[0.2em] text-[9px] font-display border-b border-white/10 pb-2 mb-2">{title}</div>
        <p className="text-[11px] text-gray-300 leading-relaxed font-sans normal-case mb-2">{content}</p>
        {footer && (
            <p className="text-[9px] text-cyan-400 font-mono uppercase tracking-widest pt-2 border-t border-white/5">{footer}</p>
        )}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-black"></div>
    </div>
);

const StatCard: React.FC<{ 
    title: string; 
    value: string | number; 
    valueColor?: string; 
    tooltipTitle: string;
    tooltipContent: string;
    tooltipFooter?: string;
    onClick?: () => void;
    className?: string;
}> = ({ title, value, valueColor = 'text-white', tooltipTitle, tooltipContent, tooltipFooter, onClick, className = "" }) => (
    <div 
        onClick={onClick}
        className={`flex-1 p-4 bg-black rounded-sm border border-white/10 text-center cursor-help group relative transition-colors hover:border-white/20 ${onClick ? 'hover:bg-white/5 cursor-pointer' : ''} ${className}`}
    >
        <TacticalStatTooltip title={tooltipTitle} content={tooltipContent} footer={tooltipFooter} />
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-display mb-1">
            {title}
        </p>
        <p className={`text-2xl font-black font-display tracking-tighter ${valueColor}`}>{value}</p>
    </div>
);

const getRiskColorClass = (risk: RiskLevel | 'N/A') => {
    switch (risk) {
        case 'Critical': return 'text-red-500';
        case 'High': return 'text-orange-500';
        case 'Moderate': return 'text-yellow-400';
        case 'Low': return 'text-blue-400';
        default: return 'text-white';
    }
}

export const GlobalStatsBar: React.FC<GlobalStatsBarProps> = ({ alerts, satelliteCount, lastSyncTime, isSyncing, onSync }) => {

    const { highestRisk, activeAlerts, nominalAssets } = useMemo(() => {
        const riskOrder: RiskLevel[] = ['Informational', 'Low', 'Moderate', 'High', 'Critical'];
        
        let highestRisk: RiskLevel = 'Informational';
        
        const completedAlerts = alerts.filter(a => a.analysisState === 'complete' && a.details);

        if (completedAlerts.length > 0) {
            highestRisk = completedAlerts.reduce((maxRisk, alert) => {
                const currentIndex = riskOrder.indexOf(alert.details!.riskLevel);
                const maxIndex = riskOrder.indexOf(maxRisk);
                return currentIndex > maxIndex ? alert.details!.riskLevel : maxRisk;
            }, 'Informational');
        }

        const activeCount = alerts.length;
        const nominalCount = Math.max(0, satelliteCount - activeCount);

        return {
            highestRisk: completedAlerts.length > 0 ? highestRisk : 'N/A' as const,
            activeAlerts: activeCount,
            nominalAssets: nominalCount
        }
    }, [alerts, satelliteCount]);

    const formattedSyncTime = useMemo(() => {
        return new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, [lastSyncTime]);

    return (
        <div className="px-3 py-4 bg-black border-b border-white/10 z-10">
            <div className="flex items-center space-x-3">
                <StatCard 
                    title="GLOBAL ASSETS" 
                    value={satelliteCount} 
                    tooltipTitle="Operational Inventory"
                    tooltipContent="Total count of Resident Space Objects (RSOs) currently tracked within the local mission context."
                    tooltipFooter="Source: Space-Track.org"
                />
                <StatCard 
                    title="NOMINAL TRACKING" 
                    value={nominalAssets} 
                    valueColor="text-gray-400" 
                    tooltipTitle="Station-Keeping Manifold"
                    tooltipContent="Assets behaving within expected physical parameters. These objects exhibit minimal divergence in the ML ensemble."
                    tooltipFooter="Physics Divergence: < 2%"
                />
                <StatCard 
                    title="ANOMALY FEED" 
                    value={activeAlerts} 
                    valueColor="text-red-500"
                    tooltipTitle="Detection Queue"
                    tooltipContent="Number of active alerts requiring operator assessment. These assets show significant deviation from historical GEO manifolds."
                    tooltipFooter="Real-Time Analysis Active"
                />
                <StatCard 
                    title="THREAT MAX" 
                    value={highestRisk}
                    valueColor={getRiskColorClass(highestRisk)}
                    tooltipTitle="Peak Severity Logic"
                    tooltipContent="The system prioritizes the most dangerous individual anomaly to ensure maximum operator awareness, regardless of total anomaly volume. If even one Critical event exists, this card remains Critical."
                    tooltipFooter="Priority: Threat Override"
                />
                <StatCard 
                    title={isSyncing ? "SYNCING..." : "LAST SYNC"}
                    value={formattedSyncTime} 
                    valueColor={isSyncing ? "text-cyan-400 animate-pulse" : "text-cyan-400"} 
                    tooltipTitle="TLE Sync Logic"
                    tooltipContent="OrbitWatch periodically refreshes TLE data every 60 seconds to ensure the SGP4 engine uses the latest orbital epochs. Click to trigger a manual synchronization."
                    tooltipFooter={`Next sync in: ~${Math.max(0, 60 - Math.floor((Date.now() - lastSyncTime)/1000))}s`}
                    onClick={onSync}
                    className={isSyncing ? "border-cyan-500/50" : ""}
                />
            </div>
        </div>
    );
};