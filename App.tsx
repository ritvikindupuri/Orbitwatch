
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as satellite from 'satellite.js';
import { AnomalyAlert, RealSatellite, ForensicEvidence } from './types.ts';
import { Header } from './components/Header.tsx';
import { GlobalStatsBar } from './components/GlobalStatsBar.tsx';
import { DashboardPanel } from './components/DashboardPanel.tsx';
import MapDisplay from './components/MapDisplay.tsx';
import { ArchiveModal } from './components/ArchiveModal.tsx';
import { fetchElasticsearchCatalog } from './services/satelliteData.ts';
import { generateAnomalyAnalysis, trainModelOnCatalog } from './services/tensorFlowService.ts';
import { dbService } from './services/databaseService.ts';
import { relayService } from './services/relayService.ts';
import { ClassificationBanner } from './components/ClassificationBanner.tsx';
import { investigationService } from './services/investigationService.ts';
import { InvestigationModule } from './components/InvestigationModule.tsx';
import { AnomalyDetailView } from './components/AnomalyDetailView.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { ChatBot } from './components/ChatBot.tsx';
import { MU, EARTH_RADIUS, SPEED_OF_LIGHT } from './constants.tsx';

export const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [loadingMessage, setLoadingMessage] = useState('Initializing SDA Intelligence Link...');
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [satelliteCatalog, setSatelliteCatalog] = useState<RealSatellite[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [archivedAlerts, setArchivedAlerts] = useState<AnomalyAlert[]>([]);
  const [isAnalysisActive, setIsAnalysisActive] = useState(false); 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'anomalies' | 'catalog'>('anomalies');
  
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isInvestigationOpen, setIsInvestigationOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const initApp = useCallback(async () => {
      try {
          setIsLoading(true);
          await investigationService.init();
          setLoadingMessage("Fetching Global Catalog...");
          const catalog = await fetchElasticsearchCatalog();
          setSatelliteCatalog(catalog);
          
          setLoadingMessage("Training Neural Pattern of Life Manifold...");
          await trainModelOnCatalog(catalog, (msg) => setLoadingMessage(msg));
          
          setIsLoading(false);
          setIsAnalysisActive(true);
          setLastSyncTime(Date.now());
      } catch (e) {
          console.error("Initialization failed", e);
          setLoadingMessage("Intelligence Link Interrupted. Retrying...");
          setTimeout(initApp, 5000);
      }
  }, []);

  useEffect(() => {
    initApp();
  }, [initApp]);

  useEffect(() => {
    const runScan = async () => {
      if (!isAnalysisActive || satelliteCatalog.length === 0) return;
      const newAlerts: AnomalyAlert[] = [];
      const batch = satelliteCatalog.slice(0, 100); 
      for (const sat of batch) {
          try {
              const analysis = await generateAnomalyAnalysis(sat);
              if (analysis.riskScore > 35) {
                  newAlerts.push({ satellite: sat, analysisState: 'complete', details: analysis, timestamp: Date.now() });
              }
          } catch (e) {}
      }
      setAlerts(newAlerts.sort((a,b) => (b.details?.riskScore||0) - (a.details?.riskScore||0)));
    };
    runScan();
  }, [isAnalysisActive, satelliteCatalog]);

  const handleSelectSatellite = useCallback((id: number | null) => {
      setSelectedSatelliteId(id);
      if (id !== null) setIsSidebarOpen(true);
  }, []);

  const handleArchiveAlert = useCallback((satelliteId: number) => {
      const alert = alerts.find(a => a.satellite.NORAD_CAT_ID === satelliteId);
      if (alert && alert.details) {
          const satrec = satellite.twoline2satrec(alert.satellite.TLE_LINE1, alert.satellite.TLE_LINE2);
          const posVel = satellite.propagate(satrec, new Date());
          if (!posVel.position || !posVel.velocity) return;
          
          const gmst = satellite.gstime(new Date());
          const position = posVel.position as satellite.EciVec3<number>;
          const velocityVec = posVel.velocity as satellite.EciVec3<number>;
          
          const gd = satellite.eciToGeodetic(position, gmst);
          const velocity = Math.sqrt(Math.pow(velocityVec.x, 2) + Math.pow(velocityVec.y, 2) + Math.pow(velocityVec.z, 2));
          const meanMotionSec = satrec.no / 60;
          const sma = Math.pow(MU / Math.pow(meanMotionSec, 2), 1/3);
          const isJamming = alert.details.riskScore > 70;
          const baseFreq = 2.245;
          const centerFreq = baseFreq + (baseFreq * (velocity / SPEED_OF_LIGHT));
          const spectrumSnapshot = [];
          for (let i = 0; i < 50; i++) {
              const offset = (i - 25) * 0.0002;
              const noise = (isJamming ? -85 : -112) + (Math.random() * 5);
              const signal = Math.exp(-Math.pow(offset, 2) / 0.000000006) * 75;
              spectrumSnapshot.push({ freq: (centerFreq + offset).toFixed(6), power: Math.max(noise, noise+signal) });
          }

          const evidence: ForensicEvidence = {
              telemetry: {
                  apogee: sma * (1 + satrec.ecco) - EARTH_RADIUS,
                  perigee: sma * (1 - satrec.ecco) - EARTH_RADIUS,
                  inclination: satrec.inclo * (180 / Math.PI),
                  velocity: velocity,
                  alt: gd.height
              },
              ensemble: {
                  aeScore: alert.details.componentScores.aeScore,
                  ifScore: alert.details.componentScores.ifScore,
                  knnScore: alert.details.componentScores.knnScore,
                  riskScore: alert.details.riskScore
              },
              sigint: {
                  centerFreq,
                  rssi: -85, 
                  isJamming,
                  spectrumData: spectrumSnapshot
              },
              frameworks: {
                  mitreTechnique: alert.details.mitreTechnique,
                  spartaClassification: alert.details.spartaClassification
              },
              predictedAction: alert.details.predictedAction,
              attributionNarrative: alert.details.attributionNarrative
          };

          setArchivedAlerts(prev => [alert, ...prev]);
          investigationService.create(
              `Forensic Case: ${alert.satellite.OBJECT_NAME}`, 
              `Attribution: ${alert.details.description}`, 
              satelliteId,
              alert.satellite.OBJECT_NAME,
              evidence
          );

          relayService.dispatchForensics(satelliteId, alert.satellite.OBJECT_NAME, evidence);

          setAlerts(prev => prev.filter(a => a.satellite.NORAD_CAT_ID !== satelliteId));
          setSelectedSatelliteId(null);
      }
  }, [alerts]);

  const selectedAlert = useMemo(() => {
      return alerts.find(s => s.satellite.NORAD_CAT_ID === selectedSatelliteId) || null;
  }, [selectedSatelliteId, alerts]);

  const filterOptions = useMemo(() => {
    const countries = Array.from(new Set(satelliteCatalog.map(s => s.OWNER))).filter(Boolean).sort();
    const types = Array.from(new Set(satelliteCatalog.map(s => s.OBJECT_TYPE))).filter(Boolean).sort();
    return { countries, types };
  }, [satelliteCatalog]);

  const filteredCatalog = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return satelliteCatalog.filter(sat => {
      const matchesSearch = !query || 
        sat.OBJECT_NAME.toLowerCase().includes(query) || 
        sat.NORAD_CAT_ID.toString().includes(query);
      const matchesCountry = countryFilter === 'all' || sat.OWNER === countryFilter;
      const matchesType = typeFilter === 'all' || sat.OBJECT_TYPE === typeFilter;
      return matchesSearch && matchesCountry && matchesType;
    });
  }, [satelliteCatalog, searchQuery, countryFilter, typeFilter]);

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return alerts.filter(alert => {
      const matchesSearch = !query || 
        alert.satellite.OBJECT_NAME.toLowerCase().includes(query) || 
        alert.satellite.NORAD_CAT_ID.toString().includes(query);
      const matchesCountry = countryFilter === 'all' || alert.satellite.OWNER === countryFilter;
      const matchesType = typeFilter === 'all' || alert.satellite.OBJECT_TYPE === typeFilter;
      const matchesRisk = riskFilter === 'all' || alert.details?.riskLevel === riskFilter;
      return matchesSearch && matchesCountry && matchesType && matchesRisk;
    });
  }, [alerts, searchQuery, countryFilter, typeFilter, riskFilter]);

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
                <div className="w-64 mb-6">
                    <div className="h-1 w-full bg-gray-900 rounded overflow-hidden">
                        <div className="h-full bg-cyan-400 animate-progress-indeterminate"></div>
                    </div>
                </div>
                <p className="text-xl font-mono text-cyan-400 font-display tracking-[0.2em] uppercase">{loadingMessage}</p>
                <style>{`@keyframes progress-indeterminate { 0% { width: 0%; margin-left: 0%; } 50% { width: 50%; margin-left: 25%; } 100% { width: 0%; margin-left: 100%; } } .animate-progress-indeterminate { animation: progress-indeterminate 1.5s ease-in-out infinite; }`}</style>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden text-gray-100 font-sans">
      <ClassificationBanner />
      <Header 
        onClearSession={() => window.location.reload()} 
        isDemoMode={false} 
        onOpenInvestigations={() => setIsInvestigationOpen(true)} 
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <GlobalStatsBar alerts={alerts} satelliteCount={satelliteCatalog.length} lastSyncTime={lastSyncTime} isSyncing={isSyncing} onSync={() => {}} />

      <div className="flex-1 relative flex flex-row overflow-hidden min-h-0">
        <div className={`relative z-0 h-full bg-black transition-all duration-500 ease-in-out ${isSidebarOpen ? 'w-1/2' : 'w-full'}`}>
            <MapDisplay 
                satelliteCatalog={filteredCatalog} 
                alerts={filteredAlerts} 
                selectedSatelliteId={selectedSatelliteId} 
                onSelectSatellite={handleSelectSatellite} 
            />
            {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="absolute top-8 right-8 z-50 flex items-center gap-3 px-6 py-4 bg-black/80 backdrop-blur-xl border border-white/20 text-white rounded-sm hover:bg-white/10 transition-all shadow-2xl group">
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase font-display">Command Panel</span>
                </button>
            )}
        </div>
        
        <div className={`shrink-0 relative z-10 h-full border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.8)] flex flex-col bg-black transition-all duration-500 ease-in-out ${isSidebarOpen ? 'w-1/2 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
            {selectedAlert ? (
                /* Removed onSaveNotes prop as it is not part of AnomalyDetailView props definition */
                <AnomalyDetailView 
                    alert={selectedAlert}
                    onBack={() => setSelectedSatelliteId(null)}
                    onArchive={() => handleArchiveAlert(selectedAlert.satellite.NORAD_CAT_ID)}
                />
            ) : (
                <DashboardPanel 
                    alerts={alerts}
                    filteredAlerts={filteredAlerts}
                    catalog={satelliteCatalog}
                    filteredCatalog={filteredCatalog}
                    selectedSatelliteId={selectedSatelliteId} 
                    onSelectSatellite={setSelectedSatelliteId} 
                    onArchiveAlert={handleArchiveAlert} 
                    onOpenArchive={() => setIsArchiveOpen(true)} 
                    onSaveNotes={() => {}} 
                    filterOptions={filterOptions} 
                    filterState={{ searchQuery, countryFilter, typeFilter, riskFilter, viewMode }}
                    onFilterChange={{ 
                        setSearchQuery, 
                        setCountryFilter, 
                        setTypeFilter, 
                        setRiskFilter, 
                        setViewMode 
                    }}
                    isSystemReady={!isLoading} 
                    onClose={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
      </div>

      <ArchiveModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} archivedAlerts={archivedAlerts} onLoadArchives={() => {}} onClearArchives={() => setArchivedAlerts([])} />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onConfigUpdated={initApp} 
      />
      
      {isInvestigationOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-8" onClick={() => setIsInvestigationOpen(false)}>
              <div className="w-full h-full max-w-7xl bg-black border border-white/20 rounded-sm shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/[0.02]">
                       <h2 className="text-xl font-bold text-white font-display tracking-[0.3em] uppercase">Tactical Forensic Investigation Suite</h2>
                       <button onClick={() => setIsInvestigationOpen(false)} className="text-gray-500 hover:text-white font-mono text-xs uppercase tracking-widest px-4 py-2 border border-white/10 rounded-sm">EXIT [ESC]</button>
                  </div>
                  <div className="flex-1 min-h-0"><InvestigationModule /></div>
              </div>
          </div>
      )}
      <ChatBot />
    </div>
  );
};
