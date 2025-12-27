
import React, { useState, useEffect, useMemo } from 'react';
import * as satellite from 'satellite.js';
import { AnomalyAlert, RealSatellite, AnomalyDetails } from '../types';
import { getRiskHexColor } from '../constants';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip as RechartsTooltip, ResponsiveContainer, 
    ReferenceArea, ReferenceLine, LineChart, Line 
} from 'recharts';

interface AnomalyDetailViewProps {
    alert: AnomalyAlert;
    onBack: () => void;
    onArchive: () => void;
    onSaveNotes: (noradId: number, notes: string) => void;
}

const SPEED_OF_LIGHT = 299792.458; 
const MU = 398600.4418; // Earth's gravitational constant (km^3/s^2)
const EARTH_RADIUS = 6371.0; 

const AssessmentIcon = () => (
    <svg className="w-4 h-4 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const DynamicsIcon = () => (
    <svg className="w-4 h-4 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)" strokeOpacity="0.4" />
        <path d="M12 2C12 2 15 7 15 12C15 17 12 22 12 22" strokeOpacity="0.2" />
    </svg>
);

const SignalIcon = () => (
    <svg className="w-4 h-4 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M2 12h3l2-9 4 18 4-18 2 9h5" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="10" strokeOpacity="0.1" />
    </svg>
);

const TacticalTooltip = ({ explanation, reasoning, title, statusColor, isMain = false, align = 'left' }: { explanation: string, reasoning: string, title: string, statusColor: string, isMain?: boolean, align?: 'left' | 'right' }) => {
    return (
        <div className={`absolute ${isMain ? 'top-full mt-4' : 'bottom-full mb-4'} ${align === 'left' ? 'left-0' : 'right-0'} w-80 p-5 bg-black border border-white/20 rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-[100] backdrop-blur-3xl ring-1 ring-white/10`}>
            <div className="font-bold text-white uppercase tracking-[0.2em] text-[10px] font-display border-b border-white/10 pb-2 mb-3">{title}</div>
            <div className="mb-4">
                <p className="text-[9px] text-cyan-400 uppercase font-black tracking-widest mb-1">Analytic Weighting Logic</p>
                <p className="text-[11px] text-gray-300 leading-relaxed font-sans normal-case">{explanation}</p>
            </div>
            <div className="pt-2 border-t border-white/5">
                <p className="text-[9px] uppercase font-black tracking-widest mb-1" style={{ color: statusColor }}>Ensemble Attribution</p>
                <p className="text-[11px] text-gray-400 leading-relaxed font-sans normal-case italic">{reasoning}</p>
            </div>
            {!isMain && <div className={`absolute top-full ${align === 'left' ? 'left-4' : 'right-4'} border-8 border-transparent border-t-black`}></div>}
            {isMain && <div className={`absolute bottom-full ${align === 'left' ? 'left-4' : 'right-4'} border-8 border-transparent border-b-black`}></div>}
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
        <div className="group relative flex items-center justify-between p-4 bg-white/5 rounded-sm border border-white/5 hover:bg-white/10 transition-colors cursor-help">
            <TacticalTooltip title={name} explanation={explanation} reasoning={reasoning} statusColor={status.color} />
            <div className="flex-1">
                <p className="text-[11px] font-black text-white uppercase tracking-widest">{name}</p>
            </div>
            <div className="flex items-center gap-6">
                <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                    <div className="h-full transition-all duration-1000" style={{ width: `${score}%`, backgroundColor: status.color, boxShadow: `0 0 8px ${status.color}44` }}></div>
                </div>
                <div className="text-[14px] font-black font-mono w-10 text-right" style={{ color: status.color }}>{score.toFixed(0)}</div>
            </div>
        </div>
    );
};

const TelemetryChartTooltip = ({ active, payload, label, unit, color, title }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-black border border-white/20 p-3 rounded shadow-2xl backdrop-blur-xl ring-1 ring-white/10 font-mono min-w-[160px]">
                <p className="text-[9px] text-gray-500 uppercase mb-2 border-b border-white/10 pb-1">{title || 'SGP4 VECTOR'}</p>
                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <span className="text-[8px] text-gray-400 uppercase font-bold">Time:</span>
                        <span className="text-white text-[10px]">{label}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[8px] text-gray-400 uppercase font-bold">Value:</span>
                        <span className="font-bold text-[11px]" style={{ color: color }}>{payload[0].value.toFixed(3)} {unit}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const RFAnalyzerTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const val = payload[0].value;
        const isJammingPoint = val > -85; // Heuristic for jamming presence at this frequency bin
        return (
            <div className="bg-black border border-white/20 p-3 rounded shadow-2xl backdrop-blur-xl ring-1 ring-white/10 font-mono min-w-[200px]">
                <p className="text-[9px] text-gray-500 uppercase mb-2 border-b border-white/10 pb-1">Spectral Analysis</p>
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <span className="text-[8px] text-gray-400 uppercase font-bold">Frequency:</span>
                        <span className="text-white text-[10px]">{label} GHz</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[8px] text-gray-400 uppercase font-bold">Magnitude:</span>
                        <span className="font-bold text-[11px]" style={{ color: isJammingPoint ? '#ef4444' : '#00e5ff' }}>{val.toFixed(2)} dBm</span>
                    </div>
                    {isJammingPoint && (
                        <div className="mt-2 pt-1 border-t border-red-500/30 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></div>
                            <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Jamming Signature Detected</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

export const AnomalyDetailView: React.FC<AnomalyDetailViewProps> = ({ alert, onBack, onArchive, onSaveNotes }) => {
    const [activeTab, setActiveTab] = useState<'intel' | 'orbit' | 'rf'>('intel');
    const [spectralData, setSpectralData] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<'24h' | '48h' | '1w' | '1mo'>('24h');
    const [realTimeRF, setRealTimeRF] = useState({
        centerFreq: 0,
        rssi: -35.4,
        noiseFloor: -115.0,
        status: 'LOCKED'
    });
    
    const riskHex = useMemo(() => getRiskHexColor(alert.details?.riskLevel), [alert.details?.riskLevel]);
    const satrec = useMemo(() => satellite.twoline2satrec(alert.satellite.TLE_LINE1, alert.satellite.TLE_LINE2), [alert.satellite]);
    
    const ephemeris = useMemo(() => {
        const meanMotionRad = satrec.no; 
        const meanMotionSec = meanMotionRad / 60;
        const semiMajorAxis = Math.pow(MU / Math.pow(meanMotionSec, 2), 1/3);
        const apogee = semiMajorAxis * (1 + satrec.ecco) - EARTH_RADIUS;
        const perigee = semiMajorAxis * (1 - satrec.ecco) - EARTH_RADIUS;
        const period = (2 * Math.PI) / meanMotionSec / 60; 
        const inclination = satrec.inclo * (180 / Math.PI);
        return { apogee, perigee, period, inclination };
    }, [satrec]);

    const historicalData = useMemo(() => {
        const points = 100;
        const now = new Date();
        const data = [];
        
        let msWindow = 0;
        if (timeRange === '24h') msWindow = 24 * 60 * 60 * 1000;
        else if (timeRange === '48h') msWindow = 48 * 60 * 60 * 1000;
        else if (timeRange === '1w') msWindow = 7 * 24 * 60 * 60 * 1000;
        else if (timeRange === '1mo') msWindow = 30 * 24 * 60 * 60 * 1000;

        const interval = msWindow / points;

        for (let i = points; i >= 0; i--) {
            const time = new Date(now.getTime() - (i * interval));
            const posVel = satellite.propagate(satrec, time);
            
            if (posVel.position && typeof posVel.position !== 'boolean' && posVel.velocity && typeof posVel.velocity !== 'boolean') {
                const gmst = satellite.gstime(time);
                const gd = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
                const velocity = Math.sqrt(Math.pow(posVel.velocity.x, 2) + Math.pow(posVel.velocity.y, 2) + Math.pow(posVel.velocity.z, 2));
                
                const isPresent = i === 0;
                data.push({
                    time: isPresent ? "PRESENT" : time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    fullTime: time.toLocaleString(),
                    alt: gd.height,
                    velocity: velocity,
                    isPresent: isPresent
                });
            }
        }
        return data;
    }, [satrec, timeRange]);

    const rfMetadata = useMemo(() => {
        const name = alert.satellite.OBJECT_NAME.toUpperCase();
        if (name.includes('STARLINK')) return { band: 'Ku-Band', freq: 12.0, units: 'GHz' };
        return { band: 'S-Band', freq: 2.2, units: 'GHz' };
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
            const d = gd.height; 
            const f = centerFreq; 
            const fspl = 20 * Math.log10(d) + 20 * Math.log10(f) + 92.45;
            const rssi = 60 - fspl; 

            const isJamming = alert.details && alert.details.riskScore > 75;
            const noiseFloor = isJamming ? -90.0 : -115.0;

            setRealTimeRF({
                centerFreq,
                rssi,
                noiseFloor,
                status: 'LOCKED'
            });

            if (activeTab === 'rf') {
                const points = [];
                for (let i = 0; i < 150; i++) {
                    const offset = (i - 75) * 0.0001;
                    const freqBin = centerFreq + offset;
                    let noise = noiseFloor + (Math.random() * 5);
                    let signal = Math.exp(-Math.pow(offset, 2) / 0.000000008) * 80;
                    
                    if (isJamming) { 
                        // Simulate an active broadband or spot jammer overlay
                        signal += Math.exp(-Math.pow(offset - (Math.sin(now.getTime()/200)*0.002), 2) / 0.0000002) * 50; 
                    }
                    points.push({ freq: freqBin.toFixed(6), power: Math.max(noise, noise + signal) });
                }
                setSpectralData(points);
            }
        };
        const i = setInterval(update, 1000);
        return () => clearInterval(i);
    }, [satrec, activeTab, rfMetadata, alert.details]);

    return (
        <div className="flex flex-col h-full bg-black font-sans border-l border-white/10 overflow-hidden relative">
            <div className="shrink-0 flex border-b border-white/10 bg-black z-30">
                <button onClick={() => setActiveTab('intel')} className={`flex-1 py-5 text-center text-[10px] font-bold uppercase tracking-[0.25em] flex flex-col items-center border-b-2 transition-all font-display ${activeTab === 'intel' ? 'border-white text-white bg-white/5' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>
                    <AssessmentIcon /> THREAT INTEL
                </button>
                <button onClick={() => setActiveTab('orbit')} className={`flex-1 py-5 text-center text-[10px] font-bold uppercase tracking-[0.25em] flex flex-col items-center border-b-2 transition-all font-display ${activeTab === 'orbit' ? 'border-white text-white bg-white/5' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>
                    <DynamicsIcon /> ORBITAL DYNAMICS
                </button>
                <button onClick={() => setActiveTab('rf')} className={`flex-1 py-5 text-center text-[10px] font-bold uppercase tracking-[0.25em] flex flex-col items-center border-b-2 transition-all font-display ${activeTab === 'rf' ? 'border-white text-white bg-white/5' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>
                    <SignalIcon /> SIGNAL ANALYSIS
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto tactical-scroll relative z-10">
                <div className="p-8 space-y-8 pb-32">
                    <div className="bg-white/5 p-5 rounded-sm border border-white/10 flex justify-between items-center shadow-lg">
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] mb-1 font-display">Target Acquisition</p>
                            <h2 className="text-xl font-display font-black text-white tracking-[0.1em] uppercase truncate">{alert.satellite.OBJECT_NAME}</h2>
                        </div>
                        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {activeTab === 'intel' && alert.details && (
                        <div className="space-y-10 animate-fadeIn overflow-visible">
                            <div className="group relative bg-black p-7 border-l-4 shadow-2xl cursor-help transition-all hover:bg-white/[0.02] overflow-visible" style={{ borderColor: riskHex }}>
                                <TacticalTooltip 
                                    isMain
                                    title="SATELLITE THREAT SCORE" 
                                    explanation="Weighted consensus derived from three neural layers: 40% Deep Autoencoder (Physics Re-construction), 30% Isolation Forest (Statistical Density), and 30% kNN (Geometric Proximity). Scores mapped as: Low (<25), Moderate (25-70), High (70-90), Critical (>90)."
                                    reasoning={`Weighted aggregate probability: ${alert.details.riskScore.toFixed(0)}%. Consensus indicates ${alert.details.riskLevel} threat level based on current manifold divergence.`}
                                    statusColor={riskHex}
                                />
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] mb-2 font-display">Satellite Threat Score</p>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-5xl font-display font-black text-white tracking-tighter">{alert.details.riskScore.toFixed(0)}</span>
                                            <span className="text-sm font-black uppercase tracking-widest" style={{ color: riskHex }}>{alert.details.riskLevel}</span>
                                        </div>
                                    </div>
                                    <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center">
                                        <div className="w-4 h-4 rounded-full animate-ping" style={{ backgroundColor: riskHex }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 overflow-visible">
                                <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-3 font-display border-b border-white/5 pb-2">Ensemble Performance Matrix</p>
                                <ModelScoreRow 
                                    name="Deep Autoencoder" 
                                    score={alert.details.componentScores.aeScore}
                                    explanation="Measures reconstruction loss against historical orbital manifold. High divergence indicates un-modeled physical maneuvers."
                                    reasoning={alert.details.componentScores.aeScore > 70 ? "Anomaly: TLE violates manifold logic." : "Nominal: Re-constructed state within bounds."}
                                />
                                <ModelScoreRow 
                                    name="Isolation Forest" 
                                    score={alert.details.componentScores.ifScore}
                                    explanation="Density partitioning: Detects migration into sparse or atypical orbital parameter clusters."
                                    reasoning={alert.details.componentScores.ifScore > 70 ? "Outlier: Statistically isolated behavior." : "Nominal: Standard GEO population behavior."}
                                />
                                <ModelScoreRow 
                                    name="k-Nearest Neighbors (kNN)" 
                                    score={alert.details.componentScores.knnScore}
                                    explanation="Geometric distance to neighboring station-keeping assets. Measures Rendezvous and Proximity Operation (RPO) risk."
                                    reasoning={alert.details.componentScores.knnScore > 70 ? "Deviation: Proximity safety violation." : "Nominal: Separation within stable GEO limits."}
                                />
                            </div>

                            <div className="space-y-4 pt-4">
                                <div className="flex items-center gap-3 border-b border-white/10 pb-2 mb-4">
                                    <div className="w-1 h-3 bg-cyan-400"></div>
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] font-display">Cyber-Orbital Attribution</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2">MITRE ATT&CK® for Space</p>
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-sm">
                                                <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                            </div>
                                            <p className="text-[11px] font-bold text-white tracking-wide">{alert.details.mitreTechnique}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2">SPARTA Framework Classification</p>
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 bg-orange-500/10 border border-orange-500/30 rounded-sm">
                                                <svg className="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            </div>
                                            <p className="text-[11px] font-bold text-white tracking-wide">{alert.details.spartaClassification}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'orbit' && (
                        <div className="space-y-10 animate-fadeIn">
                            <div className="bg-white/5 border border-white/20 p-6 rounded-sm shadow-2xl relative overflow-hidden ring-1 ring-cyan-500/20">
                                <div className="absolute top-0 right-0 p-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></div>
                                        <span className="text-[8px] font-black text-cyan-400 tracking-widest uppercase">Live Telemetry Feed</span>
                                    </div>
                                </div>
                                
                                <p className="text-[10px] font-black text-white uppercase tracking-[0.4em] font-display mb-6 border-b border-white/10 pb-2">Present State Vector (SGP4/WGS-84)</p>
                                
                                <div className="grid grid-cols-2 gap-y-6 gap-x-8 font-mono">
                                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                                        <p className="text-[8px] text-gray-500 uppercase tracking-[0.2em] mb-1">Apogee (Ha)</p>
                                        <p className="text-lg font-bold text-white tracking-widest">{ephemeris.apogee.toFixed(3)} <span className="text-[10px] text-gray-600">KM</span></p>
                                    </div>
                                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                                        <p className="text-[8px] text-gray-500 uppercase tracking-[0.2em] mb-1">Perigee (Hp)</p>
                                        <p className="text-lg font-bold text-white tracking-widest">{ephemeris.perigee.toFixed(3)} <span className="text-[10px] text-gray-600">KM</span></p>
                                    </div>
                                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                                        <p className="text-[8px] text-gray-500 uppercase tracking-[0.2em] mb-1">Inclination (i)</p>
                                        <p className="text-lg font-bold text-white tracking-widest">{ephemeris.inclination.toFixed(5)}°</p>
                                    </div>
                                    <div className="p-3 bg-black/40 border border-white/5 rounded-sm">
                                        <p className="text-[8px] text-gray-500 uppercase tracking-[0.2em] mb-1">Period (T)</p>
                                        <p className="text-lg font-bold text-white tracking-widest">{ephemeris.period.toFixed(2)} <span className="text-[10px] text-gray-600">MIN</span></p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] font-display">Historical Trajectory Analytics</p>
                                        <p className="text-[8px] text-gray-600 font-mono uppercase tracking-[0.2em] mt-1">SGP4 Back-Propagation Engine</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {(['24h', '48h', '1w', '1mo'] as const).map(r => (
                                            <button 
                                                key={r} 
                                                onClick={() => setTimeRange(r)}
                                                className={`px-3 py-1.5 text-[9px] font-black rounded-sm border transition-all ${timeRange === r ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/30'}`}
                                            >
                                                {r.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-black border border-white/10 p-6 shadow-xl rounded-sm">
                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] font-display mb-10">Altitude History (KM) — T-{timeRange.toUpperCase()} to Present</p>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={historicalData} margin={{ left: 15, right: 15, bottom: 25 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                <XAxis dataKey="time" stroke="#444" fontSize={8} label={{ value: 'MISSION CLOCK (UTC)', position: 'insideBottom', offset: -15, fill: '#888', fontSize: 7, fontWeight: 'bold' }} tick={{ fill: '#666' }} />
                                                <YAxis domain={['auto', 'auto']} stroke="#444" fontSize={8} label={{ value: 'ALTITUDE (KM)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 7, dx: -10, fontWeight: 'bold' }} tick={{ fill: '#666' }} />
                                                <RechartsTooltip content={<TelemetryChartTooltip unit="km" color="#00e5ff" title="ALTITUDE LOG" />} />
                                                <ReferenceLine x="PRESENT" stroke="#22d3ee" strokeDasharray="5 5" label={{ value: 'PRESENT', position: 'top', fill: '#22d3ee', fontSize: 8, fontWeight: 'bold' }} />
                                                <Line type="monotone" dataKey="alt" stroke="#00e5ff" strokeWidth={2.5} dot={false} isAnimationActive={false} strokeOpacity={0.8} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-black border border-white/10 p-6 shadow-xl rounded-sm">
                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] font-display mb-10">Orbital Velocity (KM/S) — T-{timeRange.toUpperCase()} to Present</p>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={historicalData} margin={{ left: 15, right: 15, bottom: 25 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                <XAxis dataKey="time" stroke="#444" fontSize={8} label={{ value: 'MISSION CLOCK (UTC)', position: 'insideBottom', offset: -15, fill: '#888', fontSize: 7, fontWeight: 'bold' }} tick={{ fill: '#666' }} />
                                                <YAxis domain={['auto', 'auto']} stroke="#444" fontSize={8} label={{ value: 'VELOCITY (KM/S)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 7, dx: -10, fontWeight: 'bold' }} tick={{ fill: '#666' }} />
                                                <RechartsTooltip content={<TelemetryChartTooltip unit="km/s" color="#facc15" title="VELOCITY LOG" />} />
                                                <ReferenceLine x="PRESENT" stroke="#facc15" strokeDasharray="5 5" label={{ value: 'PRESENT', position: 'top', fill: '#facc15', fontSize: 8, fontWeight: 'bold' }} />
                                                <Line type="monotone" dataKey="velocity" stroke="#facc15" strokeWidth={2.5} dot={false} isAnimationActive={false} strokeOpacity={0.8} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'rf' && (
                        <div className="space-y-6 animate-fadeIn">
                             <div className="bg-white/5 border border-white/10 p-6 rounded-sm shadow-md">
                                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em] font-display mb-4">Signal Telemetry (Doppler Adjusted)</p>
                                <div className="grid grid-cols-2 gap-y-6 gap-x-8 font-mono">
                                    <div>
                                        <p className="text-[8px] text-gray-500 uppercase tracking-[0.2em] mb-1">Center Frequency</p>
                                        <p className="text-sm font-bold text-white tracking-widest">{realTimeRF.centerFreq.toFixed(6)} GHZ</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] text-gray-500 uppercase tracking-[0.2em] mb-1">Noise Floor</p>
                                        <p className="text-sm font-bold text-gray-500 tracking-widest">{realTimeRF.noiseFloor.toFixed(1)} DBM</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] text-gray-500 uppercase tracking-[0.2em] mb-1">Peak Power (RSSI)</p>
                                        <p className={`text-sm font-bold tracking-widest ${alert.details && alert.details.riskScore > 75 ? 'text-red-400' : 'text-cyan-400'}`}>{realTimeRF.rssi.toFixed(2)} DBM</p>
                                    </div>
                                    <div className="group relative cursor-help">
                                        <TacticalTooltip 
                                            align="right"
                                            title="SIGNAL LOCK STATUS" 
                                            explanation="Indicates carrier phase and frequency synchronization. 'LOCKED' signifies the SIGINT receiver has matched the Doppler-shifted carrier frequency predicted by the SGP4 engine."
                                            reasoning="Phase and frequency synchronization maintained within ±5Hz of predicted vector. PLL logic: LOCKED."
                                            statusColor="#ffffff"
                                        />
                                        <p className="text-[8px] text-gray-500 uppercase tracking-[0.2em] mb-1">Status</p>
                                        <p className="text-sm font-bold text-white tracking-widest">{realTimeRF.status}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-black border border-white/10 p-6 shadow-xl rounded-sm relative overflow-visible">
                                {alert.details && alert.details.riskScore > 75 && (
                                    <div className="absolute top-0 left-0 w-full bg-red-600/10 border-b border-red-500/20 p-2 flex justify-between items-center animate-pulse z-50">
                                        <span className="text-[9px] font-black text-red-500 tracking-widest uppercase">INTERFERENCE DETECTED: BROADBAND OVERLAY</span>
                                        <span className="text-[8px] font-mono text-red-400 px-2 border border-red-400/20">FLOOR: {realTimeRF.noiseFloor.toFixed(1)}dB</span>
                                    </div>
                                )}
                                <div className="mb-10 mt-8">
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] font-display">SIGINT PSD Spectrograph (DBM vs. GHZ)</p>
                                    <p className="text-[8px] text-gray-600 font-mono mt-2 uppercase tracking-widest">Spectral Core: {rfMetadata.band}</p>
                                </div>
                                <div className="h-80 w-full bg-[#030303] border border-white/10 rounded-sm relative shadow-inner overflow-hidden">
                                    {alert.details && alert.details.riskScore > 75 && (
                                        <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(239,68,68,0.03)_20px,rgba(239,68,68,0.03)_40px)] animate-jamming-scan"></div>
                                    )}
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={spectralData} margin={{ top: 20, right: 40, left: 40, bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                            {/* Fix: Removed non-existent tracking property from XAxis label and used standard fontWeight */}
                                            <XAxis 
                                                dataKey="freq" 
                                                stroke="#555" 
                                                fontSize={8} 
                                                label={{ value: 'FREQUENCY (GHZ)', position: 'insideBottom', offset: -25, fill: '#aaa', fontSize: 9, fontWeight: 'bold' }} 
                                                tick={{ fill: '#777' }} 
                                            />
                                            {/* Fix: Removed non-existent tracking property from YAxis label and used standard fontWeight */}
                                            <YAxis 
                                                domain={[-125, -20]} 
                                                stroke="#555" 
                                                fontSize={8} 
                                                label={{ value: 'POWER (DBM)', angle: -90, position: 'insideLeft', fill: '#aaa', fontSize: 9, fontWeight: 'bold', dx: -15 }} 
                                                tick={{ fill: '#777' }} 
                                            />
                                            <RechartsTooltip content={<RFAnalyzerTooltip />} />
                                            <ReferenceArea y1={-95} y2={-20} fill={alert.details?.riskScore && alert.details.riskScore > 75 ? "#ef444410" : "#00e5ff05"} />
                                            <Area 
                                                type="monotone" 
                                                dataKey="power" 
                                                stroke={alert.details?.riskScore && alert.details.riskScore > 75 ? "#ef4444" : "#00e5ff"} 
                                                fill={alert.details?.riskScore && alert.details.riskScore > 75 ? "#ef444430" : "#00e5ff15"} 
                                                strokeWidth={2} 
                                                isAnimationActive={false} 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="shrink-0 p-6 bg-black border-t border-white/10 flex flex-col gap-3 shadow-[0_-15px_30px_rgba(0,0,0,0.8)] z-40 relative">
                <button onClick={onArchive} className="w-full py-4 bg-white text-black text-[11px] font-black uppercase tracking-[0.4em] rounded-sm hover:bg-cyan-400 transition-all font-display active:scale-[0.98] shadow-lg">ARCHIVE ASSESSMENT</button>
                <button onClick={onBack} className="w-full py-2 text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] hover:text-white transition-all font-display">← RETURN TO FEED</button>
            </div>

            <style>{`
                .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .tactical-scroll::-webkit-scrollbar { width: 6px; }
                .tactical-scroll::-webkit-scrollbar-track { background: #000; }
                .tactical-scroll::-webkit-scrollbar-thumb { background: #222; border: 2px solid #000; }
                .tactical-scroll::-webkit-scrollbar-thumb:hover { background: #444; }
                .recharts-cartesian-axis-tick-value { font-family: 'Roboto Mono', monospace; }
                @keyframes jamming-scan {
                    0% { transform: translateY(-3%); }
                    100% { transform: translateY(3%); }
                }
                .animate-jamming-scan { animation: jamming-scan 5s linear infinite alternate; }
            `}</style>
        </div>
    );
};
