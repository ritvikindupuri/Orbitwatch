
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { AnomalyAlert } from '../types';
import { getRiskHexColor, RiskLevel } from '../constants';

interface RiskDistributionChartProps {
    alerts: AnomalyAlert[];
}

const riskOrder: RiskLevel[] = ['Critical', 'High', 'Moderate', 'Low', 'Informational'];

export const RiskDistributionChart: React.FC<RiskDistributionChartProps> = ({ alerts }) => {
    const riskData = useMemo(() => {
        const counts: Record<RiskLevel, number> = {
            'Informational': 0, 'Low': 0, 'Moderate': 0, 'High': 0, 'Critical': 0
        };

        alerts.forEach(alert => {
            if (alert.details?.riskLevel) {
                counts[alert.details.riskLevel]++;
            }
        });
        
        return riskOrder
            .map(name => ({ name, count: counts[name] }))
            .filter(item => item.count > 0);

    }, [alerts]);

    const analyzedAlertsCount = useMemo(() => alerts.filter(a => a.analysisState === 'complete').length, [alerts]);

    if (analyzedAlertsCount === 0) {
        return (
             <div className="h-40 flex flex-col items-center justify-center text-center bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-bold text-sm text-gray-200 mb-2">Active Alerts by Risk Level</h3>
                <p className="text-sm text-gray-500">Awaiting analyzed alerts to populate risk distribution.</p>
            </div>
        );
    }
    
    return (
        <div className="h-40 w-full bg-gray-800/50 rounded-lg p-2 flex flex-col group relative">
             <div className="flex items-center justify-between px-2 mb-1">
                <h3 className="font-bold text-sm text-gray-200">Active Alerts by Risk Level</h3>
                <div className="relative group/icon cursor-help">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 hover:text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 border border-gray-600 rounded shadow-xl opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none z-50 text-xs text-gray-300">
                        <p className="font-bold text-cyan-400 border-b border-gray-700 pb-1 mb-2">Risk Classification Matrix</p>
                        <div className="space-y-1">
                            <div className="flex justify-between"><span className="text-rose-400 font-bold">Critical</span> <span>Score &gt; 90</span></div>
                            <div className="flex justify-between"><span className="text-orange-400 font-bold">High</span> <span>Score 70-89</span></div>
                            <div className="flex justify-between"><span className="text-amber-400 font-bold">Moderate</span> <span>Score 45-69</span></div>
                            <div className="flex justify-between"><span className="text-sky-400 font-bold">Low</span> <span>Score 20-44</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={riskData}
                        layout="vertical"
                        margin={{ top: 5, right: 35, left: 10, bottom: 0 }}
                    >
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false}
                            tick={{ fill: '#d4d4d8', fontSize: 12 }} // zinc-300
                            width={90}
                            interval={0}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(100, 116, 139, 0.2)' }}
                            contentStyle={{
                                background: 'rgba(30, 41, 59, 0.9)',
                                borderColor: '#4b5563',
                                borderRadius: '0.5rem',
                                fontSize: '12px',
                            }}
                            labelStyle={{ fontWeight: 'bold' }}
                            formatter={(value: number) => [`${value} alerts`, null]}
                        />
                        <Bar dataKey="count" minPointSize={2} radius={[0, 4, 4, 0]}>
                            {riskData.map((entry) => (
                                <Cell key={`cell-${entry.name}`} fill={getRiskHexColor(entry.name)} />
                            ))}
                             <LabelList dataKey="count" position="right" style={{ fill: '#e5e7eb', fontSize: 12, fontWeight: 'bold' }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
