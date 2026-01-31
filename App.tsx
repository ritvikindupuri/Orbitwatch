import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as satellite from 'satellite.js';
import { AnomalyAlert, RealSatellite, ForensicEvidence } from './types';
import { Header } from './components/Header';
import { GlobalStatsBar } from './components/GlobalStatsBar';
import { DashboardPanel } from './components/DashboardPanel';
import MapDisplay from './components/MapDisplay';
import { ArchiveModal } from './components/ArchiveModal';
import { fetchSpaceTrackCatalog } from './services/satelliteData';
import { generateAnomalyAnalysis, trainModelOnCatalog } from './services/tensorFlowService';
import { dbService } from './services/databaseService';
import { relayService } from './services/relayService';
import { SpaceTrackLogin } from './components/SpaceTrackLogin';
import { ClassificationBanner } from './components/ClassificationBanner';
import { investigationService } from './services/investigationService';
import { InvestigationModule } from './components/InvestigationModule';
import { AnomalyDetailView } from './components/AnomalyDetailView';

const MU = 398600.4418;
const EARTH_RADIUS = 6371.0;
const SPEED_OF_LIGHT = 299792.458;

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState<{identity: string, password: string} | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [satelliteCatalog, setSatelliteCatalog] = useState<RealSatellite[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [archivedAlerts, setArchivedAlerts] = useState<AnomalyAlert[]>([]);
  const [isAnalysisActive, setIsAnalysisActive] = useState(true); 
  
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isInvestigationOpen, setIsInvestigationOpen] = useState(false);

  useEffect(() => {
    dbService.init().catch(console.error);
    investigationService.init().catch(console.error);
  }, []);
  
  const handleLogin = async (identity: string, password: string) => {
      setLoginLoading(true);
      try {
          const catalog = await fetchSpaceTrackCatalog(identity, password);
          setSatelliteCatalog(catalog);
          setCredentials({ identity, password });
          await dbService.saveSnapshot(catalog);
          setLoginLoading(false); 
          setIsLoading(true);
          setLoadingMessage("Querying Historical GEO Data Lake...");
          setTimeout(async () => {
              const trainingSet = await dbService.getTrainingDataset(5);
              await trainModelOnCatalog(trainingSet, (msg) => setLoadingMessage(msg));
              setIsLoading(false);
              setIsAuthenticated(true);
              setIsAnalysisActive(true);
              setLastSyncTime(Date.now());
          }, 100);
      } catch (e) {
          setLoginLoading(false);
          setIsLoading(false);
          setLoginError(e instanceof Error ? e.message : "Auth Error");
      }
  };

  useEffect(() => {
    const runScan = async () => {
      if (!isAnalysisActive || !isAuthenticated || satelliteCatalog.length === 0) return;
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
  }, [isAnalysisActive, satelliteCatalog, isAuthenticated]);

  const handleSelectSatellite = useCallback((id: number | null) => {
      setSelectedSatelliteId(id);
      if (id !== null) setIsSidebarOpen(true);
  }, []);

  const handleArchiveAlert = useCallback((satelliteId: number) => {
      const alert = alerts.find(a => a.satellite.NORAD_CAT_ID === satelliteId);
      if (alert && alert.details) {
          const satrec = satellite.twoline2satrec(alert.satellite.TLE_LINE1, alert.satellite.TLE_LINE2);
          const posVel = satellite.propagate(satrec, new Date());
          const gmst = satellite.gstime(new Date());
          const gd = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
          const velocity = Math.sqrt(Math.pow(posVel.velocity.x, 2) + Math.pow(posVel.velocity.y, 2) + Math.pow(posVel.velocity.z, 2));
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
              }
          };

          setArchivedAlerts(prev => [alert, ...prev]);
          investigationService.create(
              `Forensic Case: ${alert.satellite.OBJECT_NAME}`, 
              `Attribution: ${alert.details.description}`, 
              satelliteId,
              alert.satellite.OBJECT_NAME,
              evidence
          );

          // RELAY: Push forensic commitment to the multi-operator hub
          relayService.dispatchForensics(satelliteId, alert.satellite.OBJECT_NAME, evidence);

          setAlerts(prev => prev.filter(a => a.satellite.NORAD_CAT_ID !== satelliteId));
          setSelectedSatelliteId(null);
      }
  }, [alerts]);

  const selectedAlert = useMemo(() => {
      return alerts.find(s => s.satellite.NORAD_CAT_ID === selectedSatelliteId) || null;
  }, [selectedSatelliteId, alerts]);

  if (!isAuthenticated && !isLoading) {
      return <SpaceTrackLogin onLogin={handleLogin} isLoading={loginLoading} error={loginError} />;
  }

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
      <Header onClearSession={() => { dbService.clearDatabase(); window.location.reload(); }} isDemoMode={false} onOpenInvestigations={() => setIsInvestigationOpen(true)} />
      <GlobalStatsBar alerts={alerts} satelliteCount={satelliteCatalog.length} lastSyncTime={lastSyncTime} isSyncing={isSyncing} onSync={() => {}} />

      <div className="flex-1 relative flex flex-row overflow-hidden min-h-0">
        <div className={`relative z-0 h-full bg-black transition-all duration-500 ease-in-out ${isSidebarOpen ? 'w-1/2' : 'w-full'}`}>
            <MapDisplay 
                satelliteCatalog={satelliteCatalog} 
                alerts={alerts} 
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
                <AnomalyDetailView 
                    alert={selectedAlert}
                    onBack={() => setSelectedSatelliteId(null)}
                    onArchive={() => handleArchiveAlert(selectedAlert.satellite.NORAD_CAT_ID)}
                    onSaveNotes={() => {}}
                />
            ) : (
                <DashboardPanel 
                    alerts={alerts} 
                    selectedSatelliteId={selectedSatelliteId} 
                    onSelectSatellite={setSelectedSatelliteId} 
                    onArchiveAlert={handleArchiveAlert} 
                    onOpenArchive={() => setIsArchiveOpen(true)} 
                    onSaveNotes={() => {}} 
                    filterOptions={{countries:[], types:[]}} 
                    isSystemReady={isAuthenticated} 
                    onClose={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
      </div>

      <ArchiveModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} archivedAlerts={archivedAlerts} onLoadArchives={() => {}} onClearArchives={() => setArchivedAlerts([])} />
      
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
    </div>
  );
};