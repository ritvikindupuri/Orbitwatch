
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import Globe from 'react-globe.gl';
import * as satellite from 'satellite.js';
import { AnomalyAlert, RealSatellite } from '../types';
import { getRiskHexColor } from '../constants';

interface MapDisplayProps {
  satelliteCatalog: RealSatellite[];
  alerts: AnomalyAlert[];
  selectedSatelliteId: number | null;
  onSelectSatellite: (satelliteId: number | null) => void;
}

export default function MapDisplay({ satelliteCatalog, alerts, selectedSatelliteId, onSelectSatellite }: MapDisplayProps) {
    const globeEl = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [satPositions, setSatPositions] = useState<any[]>([]);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Ensure the globe tracks the parent container size exactly
    useLayoutEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const updatePositions = () => {
            const now = new Date();
            const alertMap = new Map<number, AnomalyAlert>(alerts.map(a => [a.satellite.NORAD_CAT_ID, a]));
            
            const newSats = satelliteCatalog
                .map(sat => {
                    const alert = alertMap.get(sat.NORAD_CAT_ID);
                    const isSelected = selectedSatelliteId === sat.NORAD_CAT_ID;
                    const isAlert = !!alert;

                    const rec = satellite.twoline2satrec(sat.TLE_LINE1, sat.TLE_LINE2);
                    if (rec.error) return null;

                    const posVel = satellite.propagate(rec, now);
                    if (!posVel.position || typeof posVel.position === 'boolean') return null;

                    const gmst = satellite.gstime(now);
                    const gd = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
                    
                    const lat = satellite.degreesLat(gd.latitude);
                    const lng = satellite.degreesLong(gd.longitude);
                    const alt = gd.height / 1000;

                    const riskColor = isAlert ? getRiskHexColor(alert?.details?.riskLevel) : '#ffffff';

                    return {
                        id: sat.NORAD_CAT_ID,
                        name: sat.OBJECT_NAME,
                        owner: sat.OWNER,
                        org: sat.ORGANIZATION,
                        lat,
                        lng,
                        alt: (alt / 6371) * 0.45,
                        color: isSelected ? '#3b82f6' : riskColor,
                        radius: isSelected ? 0.25 : (isAlert ? 0.18 : 0.08),
                        isAlert,
                        riskLevel: alert?.details?.riskLevel
                    };
                })
                .filter(Boolean);

            setSatPositions(newSats);
        };

        updatePositions();
        const interval = setInterval(updatePositions, 1000);
        return () => clearInterval(interval);
    }, [satelliteCatalog, alerts, selectedSatelliteId]);

    useEffect(() => {
        if (selectedSatelliteId && globeEl.current && satPositions.length > 0) {
            const sat = satPositions.find(s => s.id === selectedSatelliteId);
            if (sat) {
                globeEl.current.pointOfView({ 
                    lat: sat.lat, 
                    lng: sat.lng, 
                    altitude: 0.35 
                }, 1200);
            }
        }
    }, [selectedSatelliteId]);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
            {dimensions.width > 0 && dimensions.height > 0 && (
                <Globe
                    ref={globeEl}
                    width={dimensions.width}
                    height={dimensions.height}
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                    bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                    backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                    
                    pointsData={satPositions}
                    pointLat="lat"
                    pointLng="lng"
                    pointAltitude="alt"
                    pointColor="color"
                    pointRadius="radius"
                    pointLabel={(d: any) => `
                        <div class="bg-black border border-white/20 p-4 rounded-sm shadow-2xl pointer-events-none backdrop-blur-xl font-sans min-w-[200px]">
                            <p class="font-black text-white uppercase border-b border-white/10 pb-2 mb-2 tracking-[0.2em] text-[11px] font-display">${d.name}</p>
                            <div class="space-y-1">
                                <p class="text-gray-500 font-mono text-[9px] uppercase"><span class="text-gray-600">ID:</span> ${d.id}</p>
                                <p class="text-gray-300 font-mono text-[9px] uppercase"><span class="text-gray-600">REGISTRY:</span> ${d.owner}</p>
                                <p class="text-cyan-400 font-mono text-[9px] uppercase"><span class="text-gray-600">ORG:</span> ${d.org}</p>
                            </div>
                            ${d.isAlert ? `<p class="font-black mt-3 text-[10px] uppercase tracking-tighter pt-2 border-t border-white/5" style="color: ${getRiskHexColor(d.riskLevel)}">THREAT STATUS: ${d.riskLevel}</p>` : ''}
                        </div>
                    `}
                    onPointClick={(d: any) => onSelectSatellite(d.id)}

                    ringsData={satPositions.filter(s => s.isAlert)}
                    ringLat="lat"
                    ringLng="lng"
                    ringColor={(d: any) => getRiskHexColor(d.riskLevel)}
                    ringMaxRadius={2.8}
                    ringPropagationSpeed={2.5}
                    ringRepeatPeriod={1400}
                    
                    backgroundColor="#000000"
                    onGlobeClick={() => onSelectSatellite(null)}
                    enablePointerInteraction={true}
                />
            )}

            <div className="absolute bottom-8 left-8 z-50 pointer-events-none">
                <div className="bg-black/80 backdrop-blur-2xl p-5 rounded-sm border border-white/10 shadow-2xl min-w-[220px] pointer-events-auto ring-1 ring-white/5">
                    <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-2">
                        <div className="w-1.5 h-4 bg-white"></div>
                        <p className="font-bold text-white tracking-[0.3em] uppercase text-[10px] font-display">SDA STATUS LEGEND</p>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="block w-2.5 h-2.5 bg-white shadow-[0_0_8px_white]"></span>
                            <span className="font-bold uppercase tracking-widest text-[9px] text-white font-display">Nominal Asset</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="block w-2.5 h-2.5 bg-blue-500 shadow-[0_0_8px_#3b82f6]"></span>
                            <span className="font-bold uppercase tracking-widest text-[9px] text-blue-400 font-display">Low-Risk Deviation</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="block w-2.5 h-2.5 bg-yellow-400 shadow-[0_0_8px_#facc15]"></span>
                            <span className="font-bold uppercase tracking-widest text-[9px] text-yellow-500 font-display">Moderate Anomaly</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="block w-2.5 h-2.5 bg-orange-500 shadow-[0_0_8px_#f97316]"></span>
                            <span className="font-bold uppercase tracking-widest text-[9px] text-orange-500 font-display">High-Risk Event</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="block w-2.5 h-2.5 bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]"></span>
                            <span className="font-bold uppercase tracking-widest text-[9px] text-red-500 font-display">Critical Alert</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
