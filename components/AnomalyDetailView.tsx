
import React, { useState, useEffect, useMemo } from 'react';
import * as satellite from 'satellite.js';
import { AnomalyAlert, RealSatellite, AnomalyDetails } from '../types';
import { getRiskHexColor } from '../constants';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip as RechartsTooltip, ResponsiveContainer, 
    ReferenceLine, LineChart, Line, Label
} from 'recharts';

interface AnomalyDetailViewProps {
    alert: AnomalyAlert;
    onBack: () => void;
    onArchive: () => void;
    onSaveNotes: (noradId: number, notes: string) => void;
}

const SPEED_OF_LIGHT = 299792.458; 
const MU = 398600.4418; 
const EARTH_RADIUS = 6371.0; 

const TacticalTooltip = ({ explanation, reasoning, title, statusColor, isMain = false }: { explanation: string, reasoning: string, title: string, statusColor: string, isMain?: boolean }) => {
    return (
        <div className={`absolute ${isMain ? 'top-full mt-4' : 'bottom-full mb-4'} left-0 w-80 p-5 bg-black border border-white/20 rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-[100] backdrop-blur-3xl ring-1 ring-white/10`}>
            <div className="font-bold text-white uppercase tracking-[0.2em] text-[10px] font-display border-b border-white/10 pb-2 mb-3">{title}</div>
            <div className="mb-4">
                <p className="text-[9px] text-cyan-400 uppercase font-black tracking-widest mb-1">Algorithmic Foundation</p>
                <p className="text-[11px] text-gray-300 leading-relaxed font-sans normal-case">{explanation}</p>
            </div>
            <div className="pt-2 border-t border-white/5">
                <p className="text-[9px] uppercase font-black tracking-widest mb-1" style={{ color: statusColor }}>Forensic Summary</p>
                <p className="text-[11px] text-gray-400 leading-relaxed font-sans normal-case italic">{reasoning}</p>
            </div>
        </div>
    );
};

const ModelScoreRow: React.FC<{ name: string; score: number; explanation: string; reasoning: string }> = ({ name, score, explanation, reasoning }) => {
    const getStatusInfo = (s: number) => {
        if (s > 90) return { color: '#ef4444' };
        if (s > 70) return { color: '#f97316' };
        if (s > 45) return { color: '#facc15' };
        if (s > 25) return { color: '#3b82f6' };
        return { color: '#ffffff' };
    };
    const status = getStatusInfo(score);

    return (
        <div className="group relative flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all cursor-help mb-2">
            <TacticalTooltip title={name} explanation={explanation} reasoning={reasoning} statusColor={status.color} />
            <div className="flex-1">
                <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] font-display">{name}</p>
            </div>
            <div className="flex items-center gap-8">
                <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                    <div className="h-full transition-all duration-1000" style={{ width: `${score}%`, backgroundColor: status.color, boxShadow: `0 0 15px ${status.color}88` }}></div>
                </div>
                <div className="text-[16px] font-black font-mono w-10 text-right" style={{ color: status.color }}>{score.toFixed(0)}</div>
            </div>
        </div>
    );
};

export const AnomalyDetailView: React.FC<AnomalyDetailViewProps> = ({ alert, onBack, onArchive, onSaveNotes }) => {
    const [activeTab, setActiveTab] = useState<'intel' | 'orbit' | 'rf'>('intel');
    const [spectralData, setSpectralData] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<'24h' | '48h' | '1w'>('24h');
    const [showPresentComparison, setShowPresentComparison] = useState(true);
    const [realTimeRF, setRealTimeRF] = useState({ centerFreq: 0, rssi: -35.4, noiseFloor: -115.0, status: 'LOCKED', currentAlt: 0, currentVel: 0 });
    
    const riskHex = useMemo(() => getRiskHexColor(alert.details?.riskLevel), [alert.details?.riskLevel]);
    const satrec = useMemo(() => satellite.twoline2satrec(alert.satellite.TLE_LINE1, alert.satellite.TLE_LINE2), [alert.satellite]);
    const isCurrentlyJamming = useMemo(() => alert.details && (alert.details.riskScore > 70), [alert.details]);
    
    // --- HISTORICAL BASELINE SAMPLES ---
    const historicalSnapshots = useMemo(() => {
        const now = new Date();
        const intervals = [
            { label: 'T-0 (PRESENT)', offset: 0 },
            { label: '24H DELTA', offset: 24 * 60 * 60 * 1000 },
            { label: '48H DELTA', offset: 48 * 60 * 60 * 1000 },
            { label: '1W DELTA', offset: 7 * 24 * 60 * 60 * 1000 }
        ];

        return intervals.map(int => {
            const time = new Date(now.getTime() - int.offset);
            const posVel = satellite.propagate(satrec, time);
            if (!posVel.position || typeof posVel.position === 'boolean' || !posVel.velocity || typeof posVel.velocity === 'boolean') return null;
            
            const gmst = satellite.gstime(time);
            const gd = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
            const velocity = Math.sqrt(Math.pow(posVel.velocity.x, 2) + Math.pow(posVel.velocity.y, 2) + Math.pow(posVel.velocity.z, 2));
            
            return {
                label: int.label,
                alt: gd.height.toFixed(2),
                vel: velocity.toFixed(4),
                timestamp: time.toLocaleString()
            };
        }).filter(Boolean);
    }, [satrec]);

    const historicalTrend = useMemo(() => {
        const points = 80;
        const now = new Date();
        const data = [];
        let msWindow = 0;
        if (timeRange === '24h') msWindow = 24 * 60 * 60 * 1000;
        else if (timeRange === '48h') msWindow = 48 * 60 * 60 * 1000;
        else if (timeRange === '1w') msWindow = 7 * 24 * 60 * 60 * 1000;

        const interval = msWindow / points;
        for (let i = points; i >= 0; i--) {
            const time = new Date(now.getTime() - (i * interval));
            const posVel = satellite.propagate(satrec, time);
            if (posVel.position && typeof posVel.position !== 'boolean' && posVel.velocity && typeof posVel.velocity !== 'boolean') {
                const gmst = satellite.gstime(time);
                const gd = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
                const velocity = Math.sqrt(Math.pow(posVel.velocity.x, 2) + Math.pow(posVel.velocity.y, 2) + Math.pow(posVel.velocity.z, 2));
                data.push({ time: time.toLocaleTimeString(), alt: gd.height, velocity: velocity });
            }
        }
        return data;
    }, [satrec, timeRange]);

    const rfMetadata = useMemo(() => {
        const name = alert.satellite.OBJECT_NAME.toUpperCase();
        if (name.includes('STARLINK')) return { band: 'Ku-Band', freq: 12.15, units: 'GHz' };
        return { band: 'S-Band', freq: 2.245, units: 'GHz' };
    }, [alert.satellite.OBJECT_NAME]);

    useEffect(() => {
        const update = () => {
            const now = new Date();
            const posVel = satellite.propagate(satrec, now);
            if (!posVel || !posVel.position || typeof posVel.position === 'boolean' || !posVel.velocity || typeof posVel.velocity === 'boolean') return;
            const gmst = satellite.gstime(now);
            const gd = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
            const velocity = Math.sqrt(Math.pow(posVel.velocity.x, 2) + Math.pow(posVel.velocity.y, 2) + Math.pow(posVel.velocity.z, 2));
            const centerFreq = rfMetadata.freq + (rfMetadata.freq * (velocity / SPEED_OF_LIGHT));
            const noiseFloor = isCurrentlyJamming ? -85.0 : -112.0;

            setRealTimeRF({ 
                centerFreq, 
                rssi: 55 - (20 * Math.log10(gd.height) + 20 * Math.log10(centerFreq) + 92.45), 
                noiseFloor, 
                status: 'LOCKED',
                currentAlt: gd.height,
                currentVel: velocity
            });

            if (activeTab === 'rf') {
                const points = [];
                for (let i = 0; i < 150; i++) {
                    const offset = (i - 75) * 0.00012;
                    let noise = noiseFloor + (Math.random() * 6);
                    let signal = Math.exp(-Math.pow(offset, 2) / 0.000000006) * 75;
                    if (isCurrentlyJamming) {
                      noise += (Math.random() * 20);
                      signal += Math.exp(-Math.pow(offset - (Math.sin(now.getTime()/250)*0.003), 2) / 0.00000015) * 45;
                    }
                    points.push({ 
                        freq: (centerFreq + offset).toFixed(6), 
                        power: Math.max(noise, noise + signal), 
                        label: `${(centerFreq + offset).toFixed(4)} GHz`,
                        isJamming: isCurrentlyJamming
                    });
                }
                setSpectralData(points);
            }
        };
        const i = setInterval(update, 1000);
        return () => clearInterval(i);
    }, [satrec, activeTab, rfMetadata, alert.details, isCurrentlyJamming]);

    return (
        <div className="flex flex-col h-full bg-black font-sans border-l border-white/10 overflow-hidden relative">
            <div className="shrink-0 flex border-b border-white/10 bg-black z-30 shadow-xl">
                <button onClick={() => setActiveTab('intel')} className={`flex-1 py-5 text-[10px] font-bold uppercase tracking-[0.25em] flex flex-col items-center border-b-2 transition-all font-display ${activeTab === 'intel' ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>THREAT INTEL</button>
                <button onClick={() => setActiveTab('orbit')} className={`flex-1 py-5 text-[10px] font-bold uppercase tracking-[0.25em] flex flex-col items-center border-b-2 transition-all font-display ${activeTab === 'orbit' ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>ORBITAL DYNAMICS</button>
                <button onClick={() => setActiveTab('rf')} className={`flex-1 py-5 text-[10px] font-bold uppercase tracking-[0.25em] flex flex-col items-center border-b-2 transition-all font-display ${activeTab === 'rf' ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>SIGNAL ANALYSIS</button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto tactical-scroll relative z-10">
                <div className="p-8 space-y-8 pb-32">
                    <div className="bg-white/5 p-5 rounded-sm border border-white/10 shadow-lg flex justify-between items-center ring-1 ring-white/5">
                        <div>
                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] mb-1 font-display">Mission Target Asset</p>
                            <h2 className="text-xl font-display font-black text-white tracking-[0.1em] uppercase">{alert.satellite.OBJECT_NAME}</h2>
                        </div>
                        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {activeTab === 'intel' && alert.details && (
                        <div className="space-y-10 animate-fadeIn overflow-visible">
                            <div className="group relative bg-black p-7 border-l-4 shadow-2xl cursor-help transition-all border-white/10" style={{ borderLeftColor: riskHex }}>
                                <TacticalTooltip 
                                    isMain title="AGGREGATE THREAT CONSENSUS" 
                                    explanation="Composite risk derived from a weighted Tri-Model ensemble. This value accounts for structural manifold deviation, statistical rarity, and physical proximity violations."
                                    reasoning={`Threat Classification: ${alert.details.riskLevel}. Forensic proof suggests an unauthorized state-change event.`} 
                                    statusColor={riskHex}
                                />
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] mb-2 font-display">Aggregate Threat Consensus</p>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-5xl font-display font-black text-white tracking-tighter">{alert.details.riskScore.toFixed(0)}</span>
                                            <span className="text-sm font-black uppercase tracking-widest" style={{ color: riskHex }}>{alert.details.riskLevel}</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-gray-700 font-mono tracking-widest uppercase mb-1">Operational ID: {alert.satellite.NORAD_CAT_ID}</div>
                                </div>
                            </div>

                            <div className="space-y-4 overflow-visible">
                                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-4 font-display border-b border-white/10 pb-2">THREAT DETECTION ANALYSIS</p>
                                <ModelScoreRow 
                                    name="NEURAL AUTOENCODER (STRUCTURAL DEVIATION)" 
                                    score={alert.details.componentScores.aeScore} 
                                    explanation="Analyzes the 7D state vector manifold. Detects when the satellite's internal structural parameters deviate from its learned 'Normal' flight style." 
                                    reasoning={alert.details.componentScores.aeScore > 70 ? "CRITICAL: Physical behavior breaks learned orbital manifold." : "NOMINAL: Conforms to historical behavior."} 
                                />
                                <ModelScoreRow 
                                    name="ISOLATION FOREST (STATISTICAL OUTLIER)" 
                                    score={alert.details.componentScores.ifScore} 
                                    explanation="Randomly partitions the dataset to isolate outliers. Higher scores indicate the asset's position is statistically unique compared to the standard GEO population." 
                                    reasoning={alert.details.componentScores.ifScore > 70 ? "ALERT: Asset is a spatial outlier in the current registry." : "NOMINAL: Position aligns with fleet density."} 
                                />
                                <ModelScoreRow 
                                    name="GEOMETRIC kNN (PROXIMITY ANALYSIS)" 
                                    score={alert.details.componentScores.knnScore} 
                                    explanation="Calculates Euclidean distance to the k-nearest orbital neighbors. Flags high-risk proximity events and potential Rendezvous/Proximity Operations (RPO)." 
                                    reasoning={alert.details.componentScores.knnScore > 70 ? "WARNING: Geometric separation at hostile threshold." : "NOMINAL: Safe station-keeping separation."} 
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'orbit' && (
                        <div className="space-y-10 animate-fadeIn">
                            {/* NEW TIME RANGE CONTROLS */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
                                <div className="flex flex-col gap-2">
                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] font-display">Temporal Observation Range</p>
                                    <div className="flex gap-2">
                                        {(['24h', '48h', '1w'] as const).map(range => (
                                            <button 
                                                key={range}
                                                onClick={() => setTimeRange(range)}
                                                className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest border transition-all rounded-sm ${timeRange === range ? 'bg-white text-black border-white shadow-[0_0_10px_white]' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30'}`}
                                            >
                                                {range.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 items-end">
                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] font-display">Real-Time Synchronization</p>
                                    <button 
                                        onClick={() => setShowPresentComparison(!showPresentComparison)}
                                        className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-3 rounded-sm ${showPresentComparison ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/50' : 'text-gray-600 border-white/10'}`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${showPresentComparison ? 'bg-cyan-400 animate-pulse' : 'bg-gray-800'}`}></div>
                                        COMPARE WITH PRESENT
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white/[0.03] border border-white/10 p-5 rounded-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 px-3 py-1 bg-white text-black text-[8px] font-black uppercase tracking-widest">Physics State Vectors</div>
                                <p className="text-[10px] font-black text-white uppercase tracking-widest mb-6 font-display">Tactical Drift Ledger (SGP4 Samples)</p>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {historicalSnapshots.map((snap, i) => (
                                        <div key={i} className={`p-4 border rounded-sm transition-all ${i === 0 ? 'bg-cyan-400/10 border-cyan-400/30' : 'bg-white/[0.02] border-white/10'}`}>
                                            <p className={`text-[9px] font-black mb-3 tracking-widest ${i === 0 ? 'text-cyan-400' : 'text-gray-500'}`}>{snap?.label}</p>
                                            <div className="space-y-1.5 font-mono">
                                                <p className="text-[10px] text-white flex justify-between"><span className="text-gray-600">ALTITUDE:</span> {snap?.alt} km</p>
                                                <p className="text-[10px] text-white flex justify-between"><span className="text-gray-600">VELOCITY:</span> {snap?.vel} km/s</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-12">
                                <div className="h-64 bg-white/[0.01] border border-white/5 rounded-sm p-6 relative">
                                    <p className="text-[10px] font-black text-white uppercase tracking-widest mb-8 flex justify-between items-center font-display">
                                      <span className="flex items-center gap-3"><div className="w-1.5 h-4 bg-cyan-400"></div> SGP4 Propagated Altitude (KM)</span>
                                      <span className="text-gray-600 font-mono text-[10px] uppercase">Δ Deviation: {Math.abs(realTimeRF.currentAlt - historicalTrend[0]?.alt).toFixed(3)} km</span>
                                    </p>
                                    <ResponsiveContainer width="100%" height="80%">
                                        <AreaChart data={historicalTrend}>
                                            <XAxis dataKey="time" hide />
                                            <YAxis domain={['auto', 'auto']} fontSize={9} tick={{fill: '#444'}} axisLine={false} tickLine={false} width={50}>
                                                <Label value="KM" position="insideLeft" angle={-90} style={{ textAnchor: 'middle', fontSize: 10, fill: '#666', fontWeight: 'bold' }} />
                                            </YAxis>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                            <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }} />
                                            <Area type="monotone" dataKey="alt" stroke="#22d3ee" fill="#22d3ee10" strokeWidth={2} isAnimationActive={false} />
                                            {showPresentComparison && (
                                                <ReferenceLine y={realTimeRF.currentAlt} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'PRESENT T-0', fill: '#ef4444', fontSize: 9, fontWeight: 'black' }} />
                                            )}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="h-64 bg-white/[0.01] border border-white/5 rounded-sm p-6 relative">
                                    <p className="text-[10px] font-black text-white uppercase tracking-widest mb-8 flex justify-between items-center font-display">
                                      <span className="flex items-center gap-3"><div className="w-1.5 h-4 bg-yellow-400"></div> SGP4 Propagated Velocity (KM/S)</span>
                                      <span className="text-gray-600 font-mono text-[10px] uppercase">Δ Deviation: {Math.abs(realTimeRF.currentVel - historicalTrend[0]?.velocity).toFixed(5)} km/s</span>
                                    </p>
                                    <ResponsiveContainer width="100%" height="80%">
                                        <LineChart data={historicalTrend}>
                                            <XAxis dataKey="time" hide />
                                            <YAxis domain={['auto', 'auto']} fontSize={9} tick={{fill: '#444'}} axisLine={false} tickLine={false} width={50}>
                                                <Label value="KM/S" position="insideLeft" angle={-90} style={{ textAnchor: 'middle', fontSize: 10, fill: '#666', fontWeight: 'bold' }} />
                                            </YAxis>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                            <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }} />
                                            <Line type="stepAfter" dataKey="velocity" stroke="#facc15" strokeWidth={2} dot={false} isAnimationActive={false} />
                                            {showPresentComparison && (
                                                <ReferenceLine y={realTimeRF.currentVel} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'PRESENT T-0', fill: '#ef4444', fontSize: 9, fontWeight: 'black' }} />
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'rf' && (
                        <div className="space-y-10 animate-fadeIn">
                            <div className="bg-white/5 p-6 border border-white/10 rounded-sm relative grid grid-cols-3 gap-6 font-mono ring-1 ring-white/5 shadow-2xl">
                                <div><p className="text-[8px] text-gray-600 uppercase mb-1 font-black tracking-widest">Shifted Center</p><p className="text-sm font-black text-white">{realTimeRF.centerFreq.toFixed(6)} GHz</p></div>
                                <div><p className="text-[8px] text-gray-600 uppercase mb-1 font-black tracking-widest">Downlink Strength</p><p className="text-sm font-black text-white">{realTimeRF.rssi.toFixed(1)} dBm</p></div>
                                <div><p className="text-[8px] text-gray-600 uppercase mb-1 font-black tracking-widest">Spectral Noise</p><p className="text-sm font-black text-gray-400">{realTimeRF.noiseFloor.toFixed(1)} dBm</p></div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                    <p className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-3 font-display">
                                      <div className={`w-2 h-2 rounded-full ${isCurrentlyJamming ? 'bg-red-500 animate-ping' : 'bg-cyan-400 animate-pulse'}`}></div>
                                      Live Spectral Analysis (PSD Capture)
                                    </p>
                                    <div className="text-[9px] font-mono text-gray-600 uppercase tracking-[0.2em]">Operational Spectrum Context</div>
                                </div>
                                
                                <div className="h-96 w-full bg-black border border-white/10 relative overflow-hidden p-8 shadow-[inset_0_0_80px_rgba(0,0,0,1)]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={spectralData}>
                                            <XAxis dataKey="freq" hide />
                                            <YAxis domain={[-125, -15]} fontSize={8} tick={{fill: '#333'}} axisLine={false} tickLine={false} width={40}>
                                                 <Label value="POWER (dBm)" position="insideLeft" angle={-90} style={{ textAnchor: 'middle', fontSize: 10, fill: '#666', fontWeight: 'bold' }} />
                                            </YAxis>
                                            {/* ENHANCED FORENSIC TOOLTIP */}
                                            <RechartsTooltip 
                                                cursor={{ stroke: '#22d3ee55', strokeWidth: 1.5 }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const p = payload[0].payload;
                                                        return (
                                                            <div className="bg-black/95 border border-white/20 p-4 font-mono shadow-2xl backdrop-blur-3xl min-w-[180px]">
                                                                <p className="text-[10px] text-cyan-400 font-bold tracking-widest mb-3 pb-2 border-b border-white/10 uppercase">Signal Attribute</p>
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between text-[11px]"><span className="text-gray-500">FREQ:</span> <span className="text-white">{p.freq} GHz</span></div>
                                                                    <div className="flex justify-between text-[11px]"><span className="text-gray-600">POWER:</span> <span className="text-white font-bold">{payload[0].value.toFixed(2)} dBm</span></div>
                                                                    <div className="flex justify-between text-[11px] pt-2 border-t border-white/5">
                                                                        <span className="text-gray-600 uppercase">INTERFERENCE:</span> 
                                                                        <span className={p.isJamming ? "text-red-500 font-black animate-pulse" : "text-green-500"}>
                                                                            {p.isJamming ? "ACTIVE" : "NOMINAL"}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="power" 
                                                stroke={isCurrentlyJamming ? "#ef4444" : "#22d3ee"} 
                                                fill={isCurrentlyJamming ? "#ef444415" : "#22d3ee10"} 
                                                strokeWidth={1.5} 
                                                dot={false} 
                                                isAnimationActive={false} 
                                            />
                                            <ReferenceLine y={realTimeRF.noiseFloor} stroke={isCurrentlyJamming ? "#ef444455" : "#22d3ee33"} strokeDasharray="5 5" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                    
                                    <div className="absolute bottom-4 right-6 text-[8px] font-mono text-gray-700 tracking-[0.3em] uppercase">X-Axis: Shifted Frequency // Y-Axis: Power (dBm)</div>
                                    
                                    {isCurrentlyJamming && (
                                        <div className="absolute top-12 left-1/2 -translate-x-1/2 px-6 py-2 bg-red-600/10 border border-red-600/50 rounded-sm text-red-500 text-[9px] font-black uppercase tracking-[0.4em] backdrop-blur-md shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                                            THREAT ALERT: Broadband Noise Injection Detected
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="shrink-0 p-6 bg-black border-t border-white/10 flex flex-col gap-3 z-40 relative shadow-[0_-20px_60px_rgba(0,0,0,0.9)]">
                <button onClick={onArchive} className="w-full py-4 bg-white text-black text-[11px] font-black uppercase tracking-[0.4em] rounded-sm hover:bg-cyan-400 transition-all font-display active:scale-[0.98]">COMMIT TO FORENSIC LEDGER</button>
                <button onClick={onBack} className="w-full py-2 text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] hover:text-white transition-all font-display">← CANCEL MISSION FOCUS</button>
            </div>
            
            <style>{`
                .tactical-scroll::-webkit-scrollbar { width: 3px; }
                .tactical-scroll::-webkit-scrollbar-thumb { background: #333; }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};
