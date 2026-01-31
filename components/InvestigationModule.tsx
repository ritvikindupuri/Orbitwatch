
import React, { useState, useEffect, useMemo } from 'react';
import { Investigation, ForensicEvidence } from '../types';
import { investigationService } from '../services/investigationService';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    ResponsiveContainer, ReferenceLine, Tooltip as RechartsTooltip, Label
} from 'recharts';

const StatusBadge: React.FC<{ status: Investigation['status'] }> = ({ status }) => {
    const colors = {
        'Preliminary Review': 'border-blue-500 text-blue-400 bg-blue-500/10',
        'Active Forensics': 'border-yellow-500 text-yellow-400 bg-yellow-500/10',
        'Hostile Attribution': 'border-orange-500 text-orange-400 bg-orange-500/10',
        'Closed/Reported': 'border-gray-500 text-gray-500 bg-gray-500/5'
    };
    return (
        <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest border rounded-sm ${colors[status]}`}>
            {status}
        </span>
    );
};

const EvidenceFile: React.FC<{ evidence: ForensicEvidence }> = ({ evidence }) => (
    <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
            <div className="p-6 bg-white/[0.03] border border-white/10 rounded-sm relative">
                <div className="absolute top-0 right-0 p-1 bg-cyan-500 text-black font-black text-[7px] uppercase tracking-widest">Physics Core Snapshot</div>
                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-4 font-display border-b border-white/5 pb-2">Captured SGP4 State Vector</p>
                <div className="grid grid-cols-2 gap-4 font-mono text-[11px]">
                    <div>
                        <span className="text-gray-600 uppercase block mb-1">Apogee Altitude</span>
                        <span className="text-white font-bold">{evidence.telemetry.apogee.toFixed(3)} KM</span>
                    </div>
                    <div>
                        <span className="text-gray-600 uppercase block mb-1">Velocity Magnitude</span>
                        <span className="text-white font-bold">{evidence.telemetry.velocity.toFixed(4)} KM/S</span>
                    </div>
                    <div>
                        <span className="text-gray-600 uppercase block mb-1">Inclination</span>
                        <span className="text-white font-bold">{evidence.telemetry.inclination.toFixed(5)}°</span>
                    </div>
                    <div>
                        <span className="text-gray-600 uppercase block mb-1">WGS84 Height</span>
                        <span className="text-white font-bold">{evidence.telemetry.alt.toFixed(2)} KM</span>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-white/[0.03] border border-white/10 rounded-sm">
                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-4 font-display border-b border-white/5 pb-2">Tactical Attribution Frameworks</p>
                <div className="space-y-4 font-mono text-[11px]">
                    <div>
                        <span className="text-gray-600 uppercase block mb-1">MITRE ATT&CK for Space:</span>
                        <span className="text-cyan-400 font-bold block">{evidence.frameworks.mitreTechnique}</span>
                    </div>
                    <div>
                        <span className="text-gray-600 uppercase block mb-1">SPARTA Classification:</span>
                        <span className="text-orange-400 font-bold block">{evidence.frameworks.spartaClassification}</span>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-white/[0.03] border border-white/10 rounded-sm">
                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-4 font-display border-b border-white/5 pb-2">Ensemble Verification Matrix</p>
                <div className="space-y-3 font-mono text-[11px]">
                    <div className="flex justify-between">
                        <span className="text-gray-600 uppercase">Fingerprint Match:</span>
                        <span className="text-white">{evidence.ensemble.aeScore}%</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600 uppercase">Density Outlier:</span>
                        <span className="text-white">{evidence.ensemble.ifScore}%</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600 uppercase">Proximity Risk:</span>
                        <span className="text-white">{evidence.ensemble.knnScore}%</span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
                        <span className="text-red-500 uppercase font-bold">Aggregate Forensic Risk:</span>
                        <span className="text-red-500 font-bold">{evidence.ensemble.riskScore}%</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-6">
            <div className="p-6 bg-white/[0.03] border border-white/10 rounded-sm flex flex-col h-full min-h-[400px]">
                <div className="flex justify-between items-center mb-6">
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] font-display">Spectral Forensics (PSD Capture)</p>
                    {evidence.sigint.isJamming && (
                        <span className="text-[8px] bg-red-600 text-white font-black px-2 py-0.5 rounded-sm animate-pulse tracking-widest">EW SIGNAL DETECTED</span>
                    )}
                </div>
                <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={evidence.sigint.spectrumData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="freq" hide />
                            <YAxis domain={[-125, -15]} fontSize={8} tick={{fill: '#444'}} axisLine={false} tickLine={false} width={35}>
                                <Label value="dBm" position="insideLeft" angle={-90} style={{ textAnchor: 'middle', fontSize: 10, fill: '#666' }} />
                            </YAxis>
                            <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }}
                                cursor={{ stroke: '#22d3ee55', strokeWidth: 1 }}
                            />
                            <Area type="monotone" dataKey="power" stroke="#22d3ee" fill="#22d3ee15" strokeWidth={1} isAnimationActive={false} />
                            <ReferenceLine y={evidence.sigint.isJamming ? -85 : -112} stroke="#ff000033" strokeDasharray="3 3" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 font-mono text-[10px]">
                    <div><span className="text-gray-600 uppercase">X-Axis Center:</span> <span className="text-white">{evidence.sigint.centerFreq.toFixed(6)} GHz</span></div>
                    <div><span className="text-gray-600 uppercase">Noise Floor:</span> <span className="text-white">{evidence.sigint.isJamming ? "-85.0" : "-112.0"} dBm</span></div>
                </div>
            </div>
        </div>
    </div>
);

export const InvestigationModule: React.FC = () => {
    const [cases, setCases] = useState<Investigation[]>([]);
    const [selectedCase, setSelectedCase] = useState<Investigation | null>(null);
    const [noteInput, setNoteInput] = useState('');

    useEffect(() => {
        setCases(investigationService.getAll());
    }, []);

    const handleAddNote = () => {
        if (!selectedCase || !noteInput.trim()) return;
        investigationService.addNote(selectedCase.id, noteInput, 'OPERATOR');
        setNoteInput('');
        const updated = investigationService.getById(selectedCase.id);
        if (updated) setSelectedCase(updated);
        setCases(investigationService.getAll());
    };

    return (
        <div className="flex flex-row h-full bg-black overflow-hidden">
            <div className="w-80 border-r border-white/10 flex flex-col bg-white/[0.01]">
                <div className="p-4 border-b border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] font-display">Dossier Index</div>
                <div className="flex-1 overflow-y-auto tactical-scroll">
                    {cases.map(c => (
                        <div key={c.id} onClick={() => setSelectedCase(c)} className={`p-5 border-b border-white/10 cursor-pointer hover:bg-white/5 transition-all ${selectedCase?.id === c.id ? 'bg-white/5 border-l-2 border-l-cyan-400' : ''}`}>
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-[11px] font-black text-white uppercase tracking-wider truncate w-40">{c.targetName}</p>
                                <StatusBadge status={c.status} />
                            </div>
                            <p className="text-[8px] text-gray-600 font-mono uppercase tracking-widest">{new Date(c.dateOpened).toLocaleDateString()} // CID: {c.id.slice(0,8)}</p>
                        </div>
                    ))}
                    {cases.length === 0 && (
                        <div className="p-10 text-center opacity-10 uppercase tracking-widest text-[9px] font-black">
                            No Active Cases
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                {selectedCase ? (
                    <div className="h-full flex flex-col p-8 tactical-scroll overflow-y-auto">
                        <div className="flex justify-between items-end mb-10 pb-6 border-b border-white/10">
                            <div>
                                <h1 className="text-4xl font-display font-black text-white tracking-widest uppercase">{selectedCase.targetName}</h1>
                                <p className="text-[10px] text-gray-600 font-mono uppercase tracking-[0.4em] mt-2">Mission Dossier // Verified Forensic Ledger</p>
                            </div>
                            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest bg-white/5 px-4 py-2 border border-white/10">
                                Case ID: {selectedCase.id}
                            </div>
                        </div>

                        {selectedCase.evidence && <EvidenceFile evidence={selectedCase.evidence} />}

                        <div className="mt-12 grid grid-cols-3 gap-8">
                            <div className="col-span-2 space-y-4">
                                <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] font-display border-b border-white/5 pb-2">Mission Log History</p>
                                <div className="space-y-4">
                                    {selectedCase.notes.map(n => (
                                        <div key={n.timestamp} className="p-4 bg-white/5 border border-white/10 rounded-sm">
                                            <div className="flex justify-between mb-2 font-mono text-[9px] text-cyan-400">
                                                <span className="uppercase font-bold tracking-widest">[{n.author}]</span>
                                                <span className="opacity-60">{new Date(n.timestamp).toLocaleString()}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-300 leading-relaxed">{n.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] font-display border-b border-white/5 pb-2">Operational Log</p>
                                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="LOG FORENSIC OBSERVATION..." className="w-full h-32 bg-black border border-white/10 p-4 text-[11px] text-white font-mono focus:outline-none focus:border-cyan-500/50 resize-none" />
                                <button onClick={handleAddNote} className="w-full py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-cyan-400 transition-all font-display">COMMIT LOG ENTRY</button>
                                <p className="text-[9px] text-gray-600 uppercase font-mono text-center">Logs are permanently appended to case history.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-center">
                        <div className="w-16 h-16 border border-white/20 flex items-center justify-center rounded-full mb-6">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <h3 className="text-xl font-display font-black text-white tracking-[0.3em] uppercase">Select Dossier to Review</h3>
                        <p className="text-[9px] text-gray-600 uppercase tracking-[0.5em] mt-2 font-mono">Forensic Access Control Active</p>
                    </div>
                )}
            </div>
            <style>{`
                .tactical-scroll::-webkit-scrollbar { width: 4px; }
                .tactical-scroll::-webkit-scrollbar-thumb { background: #222; }
            `}</style>
        </div>
    );
};
