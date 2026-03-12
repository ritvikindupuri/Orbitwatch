
import React, { useState, useEffect, useMemo } from 'react';
import * as satellite from 'satellite.js';
import { Info } from 'lucide-react';
import { AnomalyAlert, RealSatellite, AnomalyDetails } from '../types.ts';
import { getRiskHexColor, MU, EARTH_RADIUS, SPEED_OF_LIGHT } from '../constants.tsx';
import { 
	AreaChart, Area, XAxis, YAxis, CartesianGrid, 
	Tooltip as RechartsTooltip, ResponsiveContainer, 
	ReferenceLine, LineChart, Line, Label, ReferenceArea
} from 'recharts';

const TacticalTooltip = ({ title, statusColor, explanation, riskMap, position = "bottom", align = "center" }: { title: string, statusColor: string, explanation: React.ReactNode, riskMap?: string, position?: "top" | "bottom" | "right", align?: "left" | "right" | "center" }) => {
	let posClass = "";
	let arrowClass = "";
	let alignClass = "";
	let arrowAlignClass = "";
	let translateClass = "translate-y-2 group-hover:translate-y-0";

	if (position === "right") {
		posClass = "left-full ml-6 top-1/2 -translate-y-1/2";
		arrowClass = "left-[-8px] top-1/2 -translate-y-1/2 border-l border-b";
		translateClass = "translate-x-2 group-hover:translate-x-0";
	} else {
		posClass = position === "bottom" ? "bottom-full mb-6" : "top-full mt-6";
		arrowClass = position === "bottom" ? "bottom-[-8px] border-r border-b" : "top-[-8px] border-l border-t";
		
		alignClass = "left-1/2 -translate-x-1/2";
		arrowAlignClass = "left-1/2 -translate-x-1/2";

		if (align === "left") {
			alignClass = "left-0";
			arrowAlignClass = "left-6";
		} else if (align === "right") {
			alignClass = "right-0";
			arrowAlignClass = "right-6";
		}
	}

	return (
		<div className={`absolute ${posClass} ${alignClass} w-[260px] sm:w-[340px] p-6 bg-[#080808] border border-white/20 rounded shadow-[0_30px_60px_rgba(0,0,0,1)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[100] backdrop-blur-3xl ring-1 ring-white/10 text-left ${translateClass} max-w-[80vw]`}>
			<div className="font-bold text-white uppercase tracking-[0.25em] text-[10px] font-display border-b border-white/10 pb-3 mb-4 flex justify-between items-center">
				<span className="flex items-center gap-2">
					<div className="w-1 h-3 bg-cyan-400"></div>
					{title}
				</span>
				<span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Logic Node V4.0</span>
			</div>
			
			<div className="space-y-5">
				<div className="text-[12px] text-gray-300 leading-relaxed font-sans normal-case">
					{explanation}
				</div>
			</div>

			{riskMap && (
				<div className="mt-5 pt-4 border-t border-white/5 bg-white/[0.02] -mx-6 -mb-6 p-5">
					<div className="flex items-center gap-2 mb-2">
						<p className="text-[9px] uppercase font-black tracking-widest" style={{ color: statusColor }}>Severity Thresholds</p>
						<div className="flex-1 h-[1px] bg-white/5"></div>
					</div>
					<p className="text-[10px] text-gray-500 font-mono normal-case leading-tight tracking-tight">
						{riskMap}
					</p>
				</div>
			)}
			<div className={`absolute ${arrowAlignClass} w-4 h-4 bg-[#080808] rotate-45 ${arrowClass} border-white/20`}></div>
		</div>
	);
};

const ModelScoreRow: React.FC<{ name: string; score: number; mathDesc: React.ReactNode; riskMap: string }> = ({ name, score, mathDesc, riskMap }) => {
	const getStatusColor = (s: number) => {
		if (s > 90) return '#ef4444'; 
		if (s > 70) return '#f97316'; 
		if (s > 45) return '#facc15'; 
		if (s > 25) return '#3b82f6'; 
		return '#ffffff'; 
	};
	const color = getStatusColor(score);

	return (
		<div className="group relative flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all cursor-help mb-2">
			<TacticalTooltip 
				title={name} 
				statusColor={color} 
				align="left"
				explanation={
					<div className="space-y-3">
						<p className="text-cyan-400 font-bold uppercase text-[9px] tracking-widest">Model Intelligence</p>
						<div className="text-gray-300 text-[11px] leading-relaxed">
							{mathDesc}
						</div>
					</div>
				} 
				riskMap={riskMap} 
			/>
			<div className="flex-1 flex items-center gap-2">
				<p className="text-[11px] font-black text-white uppercase tracking-[0.2em] font-display">{name}</p>
				<Info className="w-3 h-3 text-gray-600" />
			</div>
			<div className="flex items-center gap-8">
				<div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden">
					<div className="h-full transition-all duration-1000" style={{ width: `${score}%`, backgroundColor: color, boxShadow: `0 0 15px ${color}88` }}></div>
				</div>
				<div className="text-[16px] font-black font-mono w-10 text-right" style={{ color: color }}>{score}</div>
			</div>
		</div>
	);
};

const MAPPING_DETAILS: Record<string, { physics: string; mitre: string; sparta: string }> = {
	'RPO': {
		physics: "The satellite is intentionally matching speed and position with another object. This is like 'tailgating' in space, often used for spying or physical tampering.",
		mitre: "MITRE T1584.001: Active positioning to enable interference. The satellite is maneuvering to stay close to a target to disrupt its operations.",
		sparta: "SPARTA REC-0002: Space Reconnaissance. The satellite has entered a 'Respect Zone' to monitor or intercept signals from a target asset."
	},
	'Nodal': {
		physics: "The satellite has changed the tilt or 'twist' of its orbital plane. This is a major move, usually to reposition over a new part of the Earth.",
		mitre: "MITRE T1584.006: Orbital Plane Change. A high-energy maneuver used to reach a new sector of space for strategic advantage.",
		sparta: "SPARTA IMP-0003: Strategic Impact. The asset is moving out of its assigned slot, potentially to threaten other satellites in a new region."
	},
	'Kinetic': {
		physics: "A sudden, sharp change in speed. This isn't normal station-keeping; the satellite is actively accelerating toward a new target or objective.",
		mitre: "MITRE T1584.005: Propulsion System Abuse. Using high-thrust burns to move quickly, often to evade tracking or reach a target before we can react.",
		sparta: "SPARTA EX-0001: Execution Phase. The propulsion profile suggests the satellite is entering a restricted zone without permission."
	},
	'Phasing': {
		physics: "The satellite is adjusting its timing to arrive at a specific point in its orbit. This is used to 'line up' with a target or a ground station.",
		mitre: "MITRE T1584.003: Time-based synchronization. Adjusting position to align with other assets or ground nodes for coordinated action.",
		sparta: "SPARTA OPS-0004: Operational Coordination. Strategic timing used to synchronize with a broader attack or mission window."
	},
	'Keep-Out': {
		physics: "The satellite has crossed a 'safety line' around another asset. This is a direct violation of space safety and creates an immediate collision risk.",
		mitre: "MITRE T1584.002: Proximity Infringement. Breaking the safety boundaries of another mission, indicating a potential physical or electronic attack.",
		sparta: "SPARTA IMP-0001: Physical Denial. The asset is occupying the same space as a target, physically preventing it from doing its job."
	},
	'Signal': {
		physics: "The satellite is turning its antennas toward a specific target while in a suspicious position. This is a classic setup for electronic warfare.",
		mitre: "MITRE T1602: Radio Frequency Jamming. Using its position to blast noise or fake signals at a target, confirmed by spectral spikes.",
		sparta: "SPARTA IMP-0005: Electronic Impact. Intentional interference detected. The satellite is close enough to 'drown out' the target's communications."
	}
};

const METRIC_EXPLANATIONS: Record<string, string> = {
	'INCLINATION': "The 'tilt' of the orbit. If this changes, the satellite is moving to a different latitude on Earth. It's like changing lanes on a highway.",
	'MEAN MOTION': "The satellite's speed. A change here means it's either moving to a different altitude (higher or lower) or actively accelerating.",
	'ECCENTRICITY': "How circular the orbit is. A 0 is a perfect circle. Changes mean the satellite is stretching its orbit to reach different points in space.",
	'RAAN': "The 'twist' of the orbital plane. Think of it as the satellite rotating its entire orbit around the Earth to face a new direction.",
	'ARG. OF PERIGEE': "Where the 'low point' of the orbit is. Changing this rotates the orbit's shape, often to line up with a specific ground target.",
	'SMA': "The average height of the satellite. A change here means the satellite is moving to a higher or lower altitude."
};

export const AnomalyDetailView: React.FC<{ alert: AnomalyAlert; onBack: () => void; onArchive: () => void; }> = ({ alert, onBack, onArchive }) => {
	const [activeTab, setActiveTab] = useState<'intel' | 'orbit' | 'rf'>('intel');
	const [orbitRange, setOrbitRange] = useState<'24h' | '48h' | '1w'>('24h');
	const [currentTime, setCurrentTime] = useState(new Date());
	const riskHex = useMemo(() => getRiskHexColor(alert.details?.riskLevel), [alert.details?.riskLevel]);

	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 5000);
		return () => clearInterval(timer);
	}, []);

	const physicsKey = alert.details?.predictedAction.split(' ')[0] || '';
	const details = MAPPING_DETAILS[physicsKey] || { 
		physics: "An active propulsion event detected via high-fidelity state-vector deltas. This represents a departure from the established Pattern of Life.", 
		mitre: "Standardized technique mapping within the MITRE ATT&CK space matrix, representing adversarial behaviors in orbital operations.", 
		sparta: "High-level classification within the Space Attack Strategy and Tactics (SPARTA) framework, identifying the intent behind a maneuver." 
	};

	const orbitalHistoryData = useMemo(() => {
		const satrec = satellite.twoline2satrec(alert.satellite.TLE_LINE1, alert.satellite.TLE_LINE2);
		const data = [];
		const now = currentTime;
		
		let hours = 24;
		if (orbitRange === '48h') hours = 48;
		if (orbitRange === '1w') hours = 168;

		// 10-second interval as requested for high-fidelity trajectory prediction
		const stepSeconds = 10; 

		for (let i = -hours * 3600; i <= 0; i += stepSeconds) {
			const time = new Date(now.getTime() + i * 1000);
			const posVel = satellite.propagate(satrec, time);
			if (posVel.position && typeof posVel.position !== 'boolean' && posVel.velocity && typeof posVel.velocity !== 'boolean') {
				const pos = posVel.position as satellite.EciVec3<number>;
				const vel = posVel.velocity as satellite.EciVec3<number>;
				
				const alt = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z) - EARTH_RADIUS;
				const velocity = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
				
				data.push({
					time: i / 3600, // hours from now
					altitude: parseFloat(alt.toFixed(2)),
					velocity: parseFloat(velocity.toFixed(3)),
					x: pos.x.toFixed(3),
					y: pos.y.toFixed(3),
					z: pos.z.toFixed(3),
					vx: vel.x.toFixed(4),
					vy: vel.y.toFixed(4),
					vz: vel.z.toFixed(4),
					timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
				});
			}
		}
		return data;
	}, [alert.satellite, orbitRange, currentTime]);

	const spectrumData = useMemo(() => {
		const satrec = satellite.twoline2satrec(alert.satellite.TLE_LINE1, alert.satellite.TLE_LINE2);
		const posVel = satellite.propagate(satrec, new Date());
		if (!posVel.velocity || typeof posVel.velocity === 'boolean') return [];
		
		const velocityVec = posVel.velocity as satellite.EciVec3<number>;
		const velocity = Math.sqrt(Math.pow(velocityVec.x, 2) + Math.pow(velocityVec.y, 2) + Math.pow(velocityVec.z, 2));
		
		const isJamming = (alert.details?.riskScore || 0) > 70;
		const baseFreq = 2.245; // S-Band center
		const centerFreq = baseFreq + (baseFreq * (velocity / SPEED_OF_LIGHT));
		const data = [];
		
		// More detailed spectrum with multiple peaks and noise
		for (let i = 0; i < 120; i++) {
			const offset = (i - 60) * 0.0001;
			const noiseFloor = (isJamming ? -82 : -115) + (Math.random() * 3);
			
			// Main signal peak
			const mainSignal = Math.exp(-Math.pow(offset, 2) / 0.000000004) * 85;
			
			// Sidebands (harmonics)
			const sideband1 = Math.exp(-Math.pow(offset - 0.002, 2) / 0.00000001) * 20;
			const sideband2 = Math.exp(-Math.pow(offset + 0.002, 2) / 0.00000001) * 20;
			
			// Jamming spikes if active
			const jamSpike = isJamming ? (Math.random() > 0.9 ? 40 : 0) : 0;

			data.push({ 
				freq: (centerFreq + offset).toFixed(6), 
				power: Math.max(noiseFloor, noiseFloor + mainSignal + sideband1 + sideband2 + jamSpike) 
			});
		}
		return data;
	}, [alert.satellite, alert.details?.riskScore]);

	const orbitalElements = useMemo(() => {
		const satrec = satellite.twoline2satrec(alert.satellite.TLE_LINE1, alert.satellite.TLE_LINE2);
		const meanMotionSec = satrec.no / 60;
		const sma = Math.pow(MU / Math.pow(meanMotionSec, 2), 1/3);
		
		// Current state for real-time stats
		const now = currentTime;
		const posVel = satellite.propagate(satrec, now);
		let currentAlt = 0;
		let currentVel = 0;
		let cartesian = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
		
		if (posVel.position && typeof posVel.position !== 'boolean' && posVel.velocity && typeof posVel.velocity !== 'boolean') {
			const pos = posVel.position as satellite.EciVec3<number>;
			const vel = posVel.velocity as satellite.EciVec3<number>;
			currentAlt = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z) - EARTH_RADIUS;
			currentVel = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
			cartesian = {
				x: pos.x, y: pos.y, z: pos.z,
				vx: vel.x, vy: vel.y, vz: vel.z
			};
		}

		return {
			sma: sma.toFixed(2),
			ecc: satrec.ecco.toFixed(6),
			inc: (satrec.inclo * 180 / Math.PI).toFixed(4),
			raan: (satrec.nodeo * 180 / Math.PI).toFixed(4),
			argp: (satrec.argpo * 180 / Math.PI).toFixed(4),
			ma: (satrec.mo * 180 / Math.PI).toFixed(4),
			apogee: (sma * (1 + satrec.ecco) - EARTH_RADIUS).toFixed(2),
			perigee: (sma * (1 - satrec.ecco) - EARTH_RADIUS).toFixed(2),
			currentAlt: currentAlt.toFixed(2),
			currentVel: currentVel.toFixed(3),
			cartesian: {
				x: cartesian.x.toFixed(3),
				y: cartesian.y.toFixed(3),
				z: cartesian.z.toFixed(3),
				vx: cartesian.vx.toFixed(4),
				vy: cartesian.vy.toFixed(4),
				vz: cartesian.vz.toFixed(4)
			}
		};
	}, [alert.satellite, currentTime]);

	return (
		<div className="flex flex-col h-full bg-black font-sans border-l border-white/10 overflow-hidden relative">
			<div className="shrink-0 flex border-b border-white/10 bg-black z-30 shadow-xl">
				<button onClick={() => setActiveTab('intel')} className={`flex-1 py-5 text-[10px] font-bold uppercase tracking-[0.25em] flex flex-col items-center border-b-2 transition-all font-display ${activeTab === 'intel' ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5' : 'border-transparent text-gray-600'}`}>THREAT INTEL</button>
				<button onClick={() => setActiveTab('orbit')} className={`flex-1 py-5 text-[10px] font-bold uppercase tracking-[0.25em] flex flex-col items-center border-b-2 transition-all font-display ${activeTab === 'orbit' ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5' : 'border-transparent text-gray-600'}`}>ORBITAL DYNAMICS</button>
				<button onClick={() => setActiveTab('rf')} className={`flex-1 py-5 text-[10px] font-bold uppercase tracking-[0.25em] flex flex-col items-center border-b-2 transition-all font-display ${activeTab === 'rf' ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5' : 'border-transparent text-gray-600'}`}>SIGNAL ANALYSIS</button>
			</div>

			<div className="flex-1 overflow-y-auto p-8 pt-12 space-y-8 pb-32 tactical-scroll">
				<div className="bg-white/5 p-6 rounded-sm border border-white/10 ring-1 ring-white/5 shadow-2xl">
					<div className="flex justify-between items-start mb-4">
						<div>
							<p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] mb-1">Mission Target Focus</p>
							<h2 className="text-2xl font-display font-black text-white tracking-[0.1em] uppercase">{alert.satellite.OBJECT_NAME}</h2>
						</div>
						<div className="text-right">
							<p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Attribution Engine</p>
							<span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-400/10 px-2 py-1 border border-cyan-400/20 uppercase">Tactical Taxonomy V3.8</span>
						</div>
					</div>
					<div className="mt-6 p-4 bg-black border-l-2 border-cyan-400 ring-1 ring-white/5">
						<p className="text-[11px] text-gray-300 font-mono leading-relaxed uppercase whitespace-pre-line">
							{alert.details?.attributionNarrative}
						</p>
					</div>
				</div>

				{activeTab === 'intel' && alert.details && (
					<div className="space-y-6">
						<div className="p-8 bg-black border border-white/10 rounded-sm relative overflow-visible group">
							<div className="flex flex-col items-start text-left">
								<p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4 font-display">FINAL THREAT SCORE</p>
								
								<div className="relative group/score cursor-help mb-6 inline-flex items-center gap-4">
									<TacticalTooltip 
										title="Threat Score Determination" 
										statusColor={riskHex} 
										position="right"
										explanation={
											<div className="space-y-4">
												<div>
													<p className="text-cyan-400 font-bold uppercase text-[9px] mb-1 tracking-widest">Score Definition</p>
													<p className="text-gray-200">The Final Threat Score is a unified index of behavioral risk. It represents our system's overall confidence that this asset is executing a non-standard or hostile maneuver based on real-time orbital and spectral indicators.</p>
												</div>
												<div className="pt-4 border-t border-white/10">
													<p className="text-cyan-400 font-bold uppercase text-[9px] mb-1 tracking-widest">How it is Calculated</p>
													<p className="mb-3 text-gray-300">Our engine uses a <strong>Tri-Model Ensemble</strong> approach to remove bias and ensure accuracy:</p>
													<ul className="space-y-2 pl-3 border-l border-cyan-500/30 font-mono text-[11px]">
														<li><strong className="text-white uppercase tracking-tight">AUTO-ENCODER (AE-POL):</strong> Compares physics deltas against a 12-month station-keeping baseline.</li>
														<li><strong className="text-white uppercase tracking-tight">ISOLATION FOREST (IF-SCAN):</strong> Measures how 'rare' this specific motion is compared to the entire 30,000+ object catalog.</li>
														<li><strong className="text-white uppercase tracking-tight">K-NEAREST NEIGHBORS (KNN-SYNC):</strong> Detects synchronization with secondary targets to identify shadowing or RPO.</li>
													</ul>
												</div>
											</div>
										} 
										riskMap="CRITICAL: >90 | HIGH: 70-89 | MODERATE: 45-69 | LOW: 25-44" 
									/>
									<div className="flex items-baseline">
										<h3 className="text-8xl font-display font-black tracking-tighter leading-none" style={{ color: riskHex }}>{alert.details.riskScore}</h3>
									</div>
									<Info className="w-6 h-6 text-gray-600 self-end mb-2" />
								</div>

								<div className="inline-block border border-white/10 bg-white/5 py-2 px-6">
									<p className="text-[12px] font-mono uppercase tracking-[0.3em] font-black" style={{ color: riskHex }}>
										CLASSIFICATION: {alert.details.riskLevel}
									</p>
								</div>
							</div>
						</div>

						<div className="p-6 bg-white/[0.03] border border-white/10 rounded-sm">
							<p className="text-[10px] font-black text-white uppercase tracking-[0.25em] mb-6 font-display border-b border-white/10 pb-2">Framework Mapping Chain</p>
							<div className="flex items-center justify-between gap-4">
								<div className="group relative flex-1 p-3 bg-black/40 border border-white/5 text-center cursor-help transition-colors hover:bg-cyan-400/5">
									<TacticalTooltip 
										title="Physics Event Explanation" 
										explanation={
											<div className="space-y-3">
												<p className="text-cyan-400 font-bold uppercase text-[9px] tracking-widest">Event Definition</p>
												<p>{details.physics}</p>
												<div className="pt-2 border-t border-white/5">
													<p className="text-[9px] text-gray-500 uppercase tracking-widest">Determination Method</p>
													<p className="text-[10px]">We compare the satellite's actual path to where it *should* be according to physics. Any gap is flagged as a maneuver.</p>
												</div>
											</div>
										} 
										statusColor="#22d3ee" 
									/>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Physics Event</p>
									<p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest font-mono truncate">{physicsKey || 'UNKNOWN'}</p>
								</div>
								<div className="text-gray-700">→</div>
								<div className="group relative flex-1 p-3 bg-black/40 border border-white/5 text-center cursor-help transition-colors hover:bg-white/5">
									<TacticalTooltip 
										title="MITRE ATT&CK Mapping" 
										explanation={
											<div className="space-y-3">
												<p className="text-white font-bold uppercase text-[9px] tracking-widest">Adversarial Tactic</p>
												<p>{details.mitre}</p>
												<div className="pt-2 border-t border-white/5">
													<p className="text-[9px] text-gray-500 uppercase tracking-widest">Determination Method</p>
													<p className="text-[10px]">We match the satellite's behavior against a global database of known 'hacker' tactics used in space operations.</p>
												</div>
											</div>
										} 
										statusColor="#ffffff" 
									/>
									<p className="text-[8px] text-gray-600 uppercase mb-1">MITRE Space</p>
									<p className="text-[10px] text-white font-black uppercase tracking-widest font-mono">{alert.details.mitreTechnique}</p>
								</div>
								<div className="text-gray-700">→</div>
								<div className="group relative flex-1 p-3 bg-black/40 border border-white/5 text-center cursor-help transition-colors hover:bg-orange-500/5">
									<TacticalTooltip 
										title="SPARTA Classification" 
										explanation={
											<div className="space-y-3">
												<p className="text-orange-500 font-bold uppercase text-[9px] tracking-widest">Strategic Intent</p>
												<p>{details.sparta}</p>
												<div className="pt-2 border-t border-white/5">
													<p className="text-[9px] text-gray-500 uppercase tracking-widest">Determination Method</p>
													<p className="text-[10px]">We rank the risk based on how dangerous the maneuver is and how close the satellite is to our own critical assets.</p>
												</div>
											</div>
										} 
										statusColor="#f97316" 
									/>
									<p className="text-[8px] text-gray-600 uppercase mb-1">SPARTA Class</p>
									<p className="text-[10px] text-orange-500 font-black uppercase tracking-widest font-mono">{alert.details.spartaClassification}</p>
								</div>
							</div>
						</div>

						<div className="p-6 bg-white/[0.02] border border-white/10 rounded-sm">
							<p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-4 font-display border-b border-white/5 pb-2">Signature Correlation Matrix</p>
							{alert.details.signatureMatch ? (
								<div className="space-y-6">
									<div className="flex items-start gap-5 animate-pulse-subtle">
										<div className="shrink-0 w-14 h-14 rounded-sm border border-cyan-400/40 flex items-center justify-center bg-cyan-400/10">
											<svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
										</div>
										<div className="flex-1">
											<p className="text-[14px] text-white font-black uppercase tracking-[0.1em] font-display">{alert.details.signatureMatch.name}</p>
											<p className="text-[10px] text-gray-400 font-mono uppercase mt-1">Archive ID: {alert.details.signatureMatch.id}</p>
										</div>
									</div>
									
									<div className="grid grid-cols-3 gap-3">
										<div className="group relative bg-white/5 border border-white/5 p-3 text-center cursor-help hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5">
											<TacticalTooltip 
												title="Orbital Metric" 
												statusColor="#94a3b8" 
												position="top"
												align="left"
												explanation="This is the specific characteristic of the satellite's path we are measuring, such as its tilt (Inclination) or how fast it orbits (Mean Motion)." 
											/>
											<p className="text-[8px] text-gray-600 uppercase mb-1">Metric</p>
											<Info className="w-2.5 h-2.5 text-gray-700 mb-1" />
										</div>
										<div className="group relative bg-white/5 border border-white/5 p-3 text-center cursor-help hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5">
											<TacticalTooltip 
												title="Historical Baseline" 
												statusColor="#94a3b8" 
												position="top"
												align="center"
												explanation="This is the 'normal' behavior recorded for this asset in the past. It serves as the standard we expect the satellite to follow during routine operations." 
											/>
											<p className="text-[8px] text-gray-600 uppercase mb-1">Historical</p>
											<Info className="w-2.5 h-2.5 text-gray-700 mb-1" />
										</div>
										<div className="group relative bg-white/5 border border-white/5 p-3 text-center cursor-help hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5">
											<TacticalTooltip 
												title="Real-Time Observation" 
												statusColor="#94a3b8" 
												position="top"
												align="right"
												explanation="This is what the satellite is doing right now. We compare this to the historical baseline to see if the satellite has moved in a way that is unusual or suspicious." 
											/>
											<p className="text-[8px] text-gray-600 uppercase mb-1">Current</p>
											<Info className="w-2.5 h-2.5 text-gray-700 mb-1" />
										</div>
										
										{alert.details.signatureMatch.comparisonData?.map((item, idx) => {
											const cleanLabel = item.label.split('(')[0].trim().toUpperCase();
											const explanation = METRIC_EXPLANATIONS[cleanLabel];
											
											return (
												<React.Fragment key={idx}>
													<div className="group relative p-3 border-b border-white/5 cursor-help hover:bg-white/5 transition-colors flex items-center gap-2">
														{explanation && (
															<TacticalTooltip 
																title={item.label} 
																statusColor="#22d3ee" 
																position="top"
																explanation={explanation} 
															/>
														)}
														<p className="text-[9px] text-gray-400 font-mono uppercase">{item.label}</p>
														{explanation && <Info className="w-2 h-2 text-gray-700" />}
													</div>
													<div className="p-3 border-b border-white/5 text-center"><p className="text-[11px] text-white font-mono">{item.hist}</p></div>
													<div className="p-3 border-b border-white/5 text-center"><p className={`text-[11px] font-mono font-black ${item.match ? 'text-green-500' : 'text-orange-500'}`}>{item.curr}</p></div>
												</React.Fragment>
											);
										})}
									</div>
									
									<p className="text-[9px] text-gray-600 italic text-center font-mono">Correlation Confirmed: Weighted profile similarity &gt; 88%</p>
								</div>
							) : (
								<p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest italic">No exact historical matches found for this specific signature profile.</p>
							)}
						</div>

						<div className="space-y-2">
							<ModelScoreRow 
								name="AUTO-ENCODER (AE-POL)" 
								score={alert.details.componentScores.aeScore} 
								mathDesc={
									<div className="space-y-2">
										<p><strong>Definition:</strong> This model learns the satellite's normal 'Pattern of Life' over the last year. It flags any movement that looks like a 'surprise' compared to its usual behavior.</p>
										<p><strong>Calculation:</strong> We use a neural network to predict where the satellite *should* be. If the actual position is far from the prediction, the score goes up.</p>
									</div>
								}
								riskMap="CRITICAL (>90): Major maneuver. HIGH (70-89): Sustained drift. MODERATE (45-69): Minor adjustment."
							/>
							<ModelScoreRow 
								name="ISOLATION FOREST (IF-SCAN)" 
								score={alert.details.componentScores.ifScore} 
								mathDesc={
									<div className="space-y-2">
										<p><strong>Definition:</strong> This model looks at the entire catalog of 30,000+ objects. It flags maneuvers that are extremely rare or unique across all known space activity.</p>
										<p><strong>Calculation:</strong> It works like a game of '20 Questions'. If we can isolate a satellite's behavior with very few questions, it means that behavior is highly unusual and suspicious.</p>
									</div>
								}
								riskMap="CRITICAL (>90): Unique signature. HIGH (70-89): Rare behavior. MODERATE (45-69): Uncommon pattern."
							/>
							<ModelScoreRow 
								name="K-NEAREST NEIGHBORS (KNN-SYNC)" 
								score={alert.details.componentScores.knnScore} 
								mathDesc={
									<div className="space-y-2">
										<p><strong>Definition:</strong> This model detects if a satellite is 'stalking' or moving in perfect sync with another object, which is a key sign of a potential attack or spying mission.</p>
										<p><strong>Calculation:</strong> It measures the distance and speed difference between nearby objects. If they are moving together like a pair of dancers, the score hits critical levels.</p>
									</div>
								}
								riskMap="CRITICAL (>90): Active Shadowing. HIGH (70-89): RPO Approach. MODERATE (45-69): Co-orbital drift."
							/>
						</div>
					</div>
				)}

				{activeTab === 'orbit' && (
					<div className="space-y-8">
						<div className="bg-white/[0.02] border border-white/10 p-6 rounded-sm">
							<div className="flex justify-between items-center mb-6 border-b border-white/5 pb-2">
								<p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] font-display">Orbital Reconstruction (SGP4)</p>
								<div className="flex gap-2">
									{(['24h', '48h', '1w'] as const).map(range => (
										<button 
											key={range}
											onClick={() => setOrbitRange(range)}
											className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest border transition-all ${orbitRange === range ? 'bg-cyan-400 text-black border-cyan-400' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30'}`}
										>
											{range}
										</button>
									))}
								</div>
							</div>
							
							<div className="space-y-8">
								<div className="h-48 w-full">
									<p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 font-mono">Altitude Profile (km)</p>
									<ResponsiveContainer width="100%" height="100%">
										<AreaChart data={orbitalHistoryData}>
											<defs>
												<linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
													<stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2}/>
													<stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
												</linearGradient>
											</defs>
											<CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
											<XAxis 
												dataKey="time" 
												stroke="#444" 
												fontSize={8} 
												tickFormatter={(val) => `${val}h`}
												reversed
											/>
											<YAxis 
												stroke="#444" 
												fontSize={10} 
												domain={['auto', 'auto']}
												tickFormatter={(val) => `${val}`}
											/>
											<RechartsTooltip 
												contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }}
												itemStyle={{ color: '#22d3ee' }}
												labelFormatter={(val) => `T${val} hours`}
											/>
											<Area 
												type="monotone" 
												dataKey="altitude" 
												stroke="#22d3ee" 
												fillOpacity={1} 
												fill="url(#colorAlt)" 
												strokeWidth={2} 
												dot={false} 
												animationDuration={1000}
											/>
										</AreaChart>
									</ResponsiveContainer>
								</div>

								<div className="h-48 w-full">
									<p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 font-mono">Velocity Profile (km/s)</p>
									<ResponsiveContainer width="100%" height="100%">
										<AreaChart data={orbitalHistoryData}>
											<defs>
												<linearGradient id="colorVel" x1="0" y1="0" x2="0" y2="1">
													<stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
													<stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
												</linearGradient>
											</defs>
											<CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
											<XAxis 
												dataKey="time" 
												stroke="#444" 
												fontSize={8} 
												tickFormatter={(val) => `${val}h`}
												reversed
											/>
											<YAxis 
												stroke="#444" 
												fontSize={10} 
												domain={['auto', 'auto']}
												tickFormatter={(val) => `${val}`}
											/>
											<RechartsTooltip 
												contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }}
												itemStyle={{ color: '#f97316' }}
												labelFormatter={(val) => `T${val} hours`}
											/>
											<Area 
												type="monotone" 
												dataKey="velocity" 
												stroke="#f97316" 
												fillOpacity={1} 
												fill="url(#colorVel)" 
												strokeWidth={2} 
												dot={false} 
												animationDuration={1000}
											/>
										</AreaChart>
									</ResponsiveContainer>
								</div>
							</div>
							<p className="text-[9px] text-gray-600 font-mono mt-6 uppercase tracking-widest text-center">Historical State Reconstruction via SGP4 Manifold Propagation</p>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 bg-white/[0.02] border border-white/10 rounded-sm">
								<p className="text-[8px] text-gray-600 uppercase mb-2 tracking-widest">Current Altitude / Velocity</p>
								<p className="text-lg font-display font-black text-white">{orbitalElements.currentAlt} <span className="text-[10px] text-gray-500 font-mono">KM</span> / {orbitalElements.currentVel} <span className="text-[10px] text-gray-500 font-mono">KM/S</span></p>
							</div>
							<div className="p-4 bg-white/[0.02] border border-white/10 rounded-sm">
								<p className="text-[8px] text-gray-600 uppercase mb-2 tracking-widest">Apogee / Perigee (Calculated)</p>
								<p className="text-lg font-display font-black text-cyan-400">{orbitalElements.apogee} / {orbitalElements.perigee} <span className="text-[10px] text-gray-500 font-mono">KM</span></p>
							</div>
						</div>

						<div className="p-6 bg-white/[0.02] border border-white/10 rounded-sm">
							<p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6 font-display border-b border-white/10 pb-2">Cartesian State Vectors (ECI)</p>
							<div className="grid grid-cols-2 gap-y-6">
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Position X</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.cartesian.x} km</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Velocity vX</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.cartesian.vx} km/s</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Position Y</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.cartesian.y} km</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Velocity vY</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.cartesian.vy} km/s</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Position Z</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.cartesian.z} km</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Velocity vZ</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.cartesian.vz} km/s</p>
								</div>
							</div>
						</div>

						<div className="p-6 bg-white/[0.02] border border-white/10 rounded-sm">
							<p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6 font-display border-b border-white/10 pb-2">Keplerian State Vectors (Real-Time)</p>
							<div className="grid grid-cols-2 gap-y-6">
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Semi-Major Axis</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.sma} km</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Eccentricity</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.ecc}</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Inclination</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.inc}°</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">RAAN</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.raan}°</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Arg. of Perigee</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.argp}°</p>
								</div>
								<div>
									<p className="text-[8px] text-gray-600 uppercase mb-1">Mean Anomaly</p>
									<p className="text-sm font-mono text-gray-300">{orbitalElements.ma}°</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{activeTab === 'rf' && (
					<div className="space-y-8">
						<div className="bg-white/[0.02] border border-white/10 p-6 rounded-sm">
							<div className="flex justify-between items-center mb-6 border-b border-white/5 pb-2">
								<p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] font-display">High-Resolution Spectral Density (S-Band)</p>
								{(alert.details?.riskScore || 0) > 70 && (
									<span className="text-[9px] font-black bg-red-500 text-white px-2 py-0.5 rounded-sm animate-pulse">EW INTERFERENCE DETECTED</span>
								)}
							</div>
							<div className="h-64 w-full relative">
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart data={spectrumData}>
										<defs>
											<linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
												<stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4}/>
												<stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
											</linearGradient>
										</defs>
										<CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
										<XAxis 
											dataKey="freq" 
											stroke="#444" 
											fontSize={8} 
											tickFormatter={(val) => `${parseFloat(val).toFixed(4)}`}
										/>
										<YAxis 
											stroke="#444" 
											fontSize={10} 
											domain={[-130, -10]}
											tickFormatter={(val) => `${val}dBm`}
										/>
										<RechartsTooltip 
											contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }}
											labelStyle={{ color: '#666' }}
											itemStyle={{ color: '#22d3ee' }}
											formatter={(val: number) => [`${val.toFixed(2)} dBm`, 'Power']}
											labelFormatter={(val) => `Frequency: ${val} GHz`}
										/>
										{(alert.details?.riskScore || 0) > 70 && (
											<ReferenceArea 
												x1={spectrumData[Math.floor(spectrumData.length * 0.4)]?.freq} 
												x2={spectrumData[Math.floor(spectrumData.length * 0.6)]?.freq} 
												fill="#ef4444" 
												fillOpacity={0.1} 
												stroke="#ef4444" 
												strokeDasharray="3 3"
											/>
										)}
										<Area 
											type="monotone" 
											dataKey="power" 
											stroke="#22d3ee" 
											fillOpacity={1} 
											fill="url(#colorPower)" 
											strokeWidth={1.5}
											animationDuration={1000}
										/>
									</AreaChart>
								</ResponsiveContainer>
								
								{(alert.details?.riskScore || 0) > 70 && (
									<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
										<div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md p-3 rounded text-center">
											<p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Interference Zone</p>
											<p className="text-[9px] text-gray-400 font-mono max-w-[180px]">Broadband noise injection detected at center frequency.</p>
										</div>
									</div>
								)}
							</div>
							<div className="flex justify-between mt-4 text-[9px] font-mono text-gray-600 uppercase tracking-widest">
								<span>Start: {spectrumData[0]?.freq} GHz</span>
								<span className="text-cyan-400 font-bold">Center: {spectrumData[Math.floor(spectrumData.length/2)]?.freq} GHz</span>
								<span>End: {spectrumData[spectrumData.length-1]?.freq} GHz</span>
							</div>
						</div>

						{(alert.details?.riskScore || 0) > 70 && (
							<div className="p-5 bg-red-500/5 border border-red-500/20 rounded-sm">
								<div className="flex items-center gap-3 mb-3">
									<div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
									<p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">What is Interference?</p>
								</div>
								<p className="text-[11px] text-gray-300 leading-relaxed">
									<strong>Electronic Jamming Detected:</strong> Someone is intentionally broadcasting loud radio noise on the same frequency as this satellite. This "drowns out" the satellite's voice, making it impossible for it to receive commands or send data back to Earth. It's like someone screaming while you're trying to have a conversation.
								</p>
							</div>
						)}

						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 bg-white/[0.02] border border-white/10 rounded-sm">
								<p className="text-[8px] text-gray-600 uppercase mb-2 tracking-widest">Noise Floor (Avg)</p>
								<p className="text-lg font-display font-black text-white">{(alert.details?.riskScore || 0) > 70 ? '-82.4' : '-115.8'} <span className="text-[10px] text-gray-500 font-mono">DBM</span></p>
							</div>
							<div className="p-4 bg-white/[0.02] border border-white/10 rounded-sm">
								<p className="text-[8px] text-gray-600 uppercase mb-2 tracking-widest">SNR (Signal-to-Noise)</p>
								<p className="text-lg font-display font-black text-cyan-400">{(alert.details?.riskScore || 0) > 70 ? '14.2' : '48.5'} <span className="text-[10px] text-gray-500 font-mono">DB</span></p>
							</div>
							<div className="p-4 bg-white/[0.02] border border-white/10 rounded-sm">
								<p className="text-[8px] text-gray-600 uppercase mb-2 tracking-widest">Center Frequency (Doppler)</p>
								<p className="text-lg font-display font-black text-white">{spectrumData[Math.floor(spectrumData.length/2)]?.freq} <span className="text-[10px] text-gray-500 font-mono">GHZ</span></p>
							</div>
							<div className="p-4 bg-white/[0.02] border border-white/10 rounded-sm">
								<p className="text-[8px] text-gray-600 uppercase mb-2 tracking-widest">Occupied Bandwidth</p>
								<p className="text-lg font-display font-black text-white">1.24 <span className="text-[10px] text-gray-500 font-mono">MHZ</span></p>
							</div>
						</div>

						<div className="p-6 bg-white/[0.02] border border-white/10 rounded-sm">
							<p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6 font-display border-b border-white/10 pb-2">SIGINT Diagnostics (Real-Time)</p>
							<div className="space-y-4">
								<div className="flex justify-between items-center">
									<p className="text-[9px] text-gray-400 uppercase font-mono">Doppler Shift (Δf)</p>
									<p className="text-[11px] text-cyan-400 font-mono font-bold">+0.00042 GHz</p>
								</div>
								<div className="flex justify-between items-center">
									<p className="text-[9px] text-gray-400 uppercase font-mono">Signal Polarization</p>
									<p className="text-[11px] text-white font-mono">RHCP (Right-Hand Circular)</p>
								</div>
								<div className="flex justify-between items-center">
									<p className="text-[9px] text-gray-400 uppercase font-mono">Modulation Type</p>
									<p className="text-[11px] text-white font-mono">BPSK / QPSK Hybrid</p>
								</div>
								<div className="flex justify-between items-center">
									<p className="text-[9px] text-gray-400 uppercase font-mono">Symbol Rate</p>
									<p className="text-[11px] text-white font-mono">2.048 Msps</p>
								</div>
								<div className="flex justify-between items-center">
									<p className="text-[9px] text-gray-400 uppercase font-mono">Bit Error Rate (BER)</p>
									<p className="text-[11px] text-green-500 font-mono">1.2e-7 (NOMINAL)</p>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			<div className="shrink-0 p-6 bg-black border-t border-white/10 flex flex-col gap-3 z-40 relative shadow-[0_-20px_60px_rgba(0,0,0,0.9)]">
				<button onClick={onArchive} className="w-full py-4 bg-white text-black text-[11px] font-black uppercase tracking-[0.4em] rounded-sm hover:bg-cyan-400 transition-all font-display active:scale-[0.98]">COMMIT TO FORENSIC LEDGER</button>
				<button onClick={onBack} className="w-full py-2 text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] hover:text-white transition-all font-display">← CANCEL MISSION FOCUS</button>
			</div>
			<style>{`
				.tactical-scroll::-webkit-scrollbar { width: 4px; }
				.tactical-scroll::-webkit-scrollbar-thumb { background: #111; border-radius: 10px; }
				.tactical-scroll::-webkit-scrollbar-thumb:hover { background: #22d3ee55; }
				@keyframes pulse-subtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
				.animate-pulse-subtle { animation: pulse-subtle 3s infinite ease-in-out; }
			`}</style>
		</div>
	);
};
