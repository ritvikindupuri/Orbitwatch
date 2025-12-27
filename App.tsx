import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AnomalyAlert, RealSatellite, AnomalyDetails } from './types';
import { Header } from './components/Header';
import { GlobalStatsBar } from './components/GlobalStatsBar';
import { DashboardPanel } from './components/DashboardPanel';
import MapDisplay from './components/MapDisplay';
import { ArchiveModal } from './components/ArchiveModal';
import { fetchSpaceTrackCatalog } from './services/satelliteData';
import { generateAnomalyAnalysis, trainModelOnCatalog } from './services/tensorFlowService';
import { dbService } from './services/databaseService';
import { SpaceTrackLogin } from './components/SpaceTrackLogin';
import { ClassificationBanner } from './components/ClassificationBanner';
import { investigationService } from './services/investigationService';
import { InvestigationModule } from './components/InvestigationModule';
import { AnomalyDetailView } from './components/AnomalyDetailView';

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
  
  const [satelliteCatalog, setSatelliteCatalog] = useState<RealSatellite[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [archivedAlerts, setArchivedAlerts] = useState<AnomalyAlert[]>([]);
  const [isAnalysisActive, setIsAnalysisActive] = useState(true); 
  
  const alertsRef = useRef<AnomalyAlert[]>(alerts);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isInvestigationOpen, setIsInvestigationOpen] = useState(false);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    dbService.init().catch(console.error);
    investigationService.init().catch(console.error);
  }, []);
  
  const performSync = useCallback(async () => {
      if (!credentials || isSyncing) return;
      setIsSyncing(true);
      try {
          const updatedCatalog = await fetchSpaceTrackCatalog(credentials.identity, credentials.password);
          await dbService.saveSnapshot(updatedCatalog);
          const trainingSet = await dbService.getTrainingDataset(5);
          await trainModelOnCatalog(trainingSet);
          setSatelliteCatalog(updatedCatalog);
          setLastSyncTime(Date.now());
      } catch (err) {
          console.warn("Manual Sync failed:", err);
      } finally {
          setIsSyncing(false);
      }
  }, [credentials, isSyncing]);

  const handleLogin = async (identity: string, password: string) => {
      setLoginLoading(true);
      setLoginError(null);
      try {
          const catalog = await fetchSpaceTrackCatalog(identity, password);
          setSatelliteCatalog(catalog);
          setCredentials({ identity, password });
          await dbService.saveSnapshot(catalog);

          setLoginLoading(false); 
          setIsLoading(true);
          setLoadingMessage("Querying Historical GEO Data Lake...");
          
          setTimeout(async () => {
              try {
                  const trainingSet = await dbService.getTrainingDataset(5);
                  setLoadingMessage(`Training Hybrid Ensemble on ${trainingSet.length} GEO records...`);
                  await trainModelOnCatalog(trainingSet, (msg) => setLoadingMessage(msg));
                  setIsLoading(false);
                  setIsAuthenticated(true);
                  setIsAnalysisActive(true);
                  setLastSyncTime(Date.now());
              } catch (trainErr) {
                   setIsLoading(false);
                   if (trainErr instanceof Error) setLoginError(`Model Training Failed: ${trainErr.message}`);
              }
          }, 100);

      } catch (e) {
          setLoginLoading(false);
          setIsLoading(false);
          if (e instanceof Error) setLoginError(e.message);
          else setLoginError("An unknown error occurred connecting to Space-Track.");
      }
  };

  useEffect(() => {
    const runFullScan = async () => {
      if (!isAnalysisActive || !isAuthenticated || satelliteCatalog.length === 0) return;
      const newAlerts: AnomalyAlert[] = [];
      const BATCH_SIZE = 50;
      for (let i = 0; i < satelliteCatalog.length; i += BATCH_SIZE) {
          const batch = satelliteCatalog.slice(i, i + BATCH_SIZE);
          for (const sat of batch) {
              try {
                  const analysis = await generateAnomalyAnalysis(sat);
                  if (analysis.riskScore > 35) {
                      newAlerts.push({ satellite: sat, analysisState: 'complete', details: analysis, timestamp: Date.now() });
                  }
              } catch (e) {}
          }
          await new Promise(r => setTimeout(r, 10));
      }
      newAlerts.sort((a, b) => (b.details?.riskScore || 0) - (a.details?.riskScore || 0));
      setAlerts(newAlerts);
    };
    runFullScan();
  }, [isAnalysisActive, satelliteCatalog, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !credentials) return;
    const REFRESH_INTERVAL_MS = 60000;
    const refreshTimer = setInterval(() => {
        performSync();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimer);
  }, [isAuthenticated, credentials, performSync]);

  const handleArchiveAlert = useCallback((satelliteId: number) => {
      const alertToArchive = alerts.find(a => a.satellite.NORAD_CAT_ID === satelliteId);
      if (alertToArchive) {
          setArchivedAlerts(prev => [alertToArchive, ...prev]);
          investigationService.create(`Assessment: ${alertToArchive.satellite.OBJECT_NAME}`, `Automated Threat Assessment Report\nNORAD ID: ${satelliteId}\nRisk Level: ${alertToArchive.details?.riskLevel}\nScore: ${alertToArchive.details?.riskScore}`, satelliteId);
          setAlerts(prev => prev.filter(a => a.satellite.NORAD_CAT_ID !== satelliteId));
          if (selectedSatelliteId === satelliteId) setSelectedSatelliteId(null);
      }
  }, [alerts, selectedSatelliteId]);

  const handleSaveNotes = useCallback((noradId: number, notes: string) => {
      setAlerts(prev => prev.map(alert => {
          if (alert.satellite.NORAD_CAT_ID === noradId && alert.details) {
              return { ...alert, details: { ...alert.details, operatorNotes: notes } };
          }
          return alert;
      }));
  }, []);

  const filterOptions = useMemo(() => {
      const countries = Array.from(new Set(satelliteCatalog.map(s => s.OWNER))).sort();
      const types = Array.from(new Set(satelliteCatalog.map(s => s.OBJECT_TYPE))).sort();
      return { countries, types };
  }, [satelliteCatalog]);

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
                <div className="flex items-center space-x-3">
                    <p className="text-xl font-mono text-cyan-400 font-display tracking-[0.2em] uppercase">{loadingMessage}</p>
                </div>
                <p className="mt-2 text-[9px] text-gray-700 font-mono uppercase tracking-widest">Initialising Mission Context...</p>
                <style>{`@keyframes progress-indeterminate { 0% { width: 0%; margin-left: 0%; } 50% { width: 50%; margin-left: 25%; } 100% { width: 0%; margin-left: 100%; } } .animate-progress-indeterminate { animation: progress-indeterminate 1.5s ease-in-out infinite; }`}</style>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden text-gray-100 font-sans">
      <ClassificationBanner />
      <Header onClearSession={() => { dbService.clearDatabase(); window.location.reload(); }} isDemoMode={false} onOpenInvestigations={() => setIsInvestigationOpen(true)} />
      <GlobalStatsBar alerts={alerts} satelliteCount={satelliteCatalog.length} lastSyncTime={lastSyncTime} isSyncing={isSyncing} onSync={performSync} />

      <div className="flex-1 relative flex flex-row overflow-hidden">
        {/* Main View: Globe Map */}
        <div className="flex-1 relative z-0 min-h-0 bg-black">
            <MapDisplay satelliteCatalog={satelliteCatalog} alerts={alerts} selectedSatelliteId={selectedSatelliteId} onSelectSatellite={setSelectedSatelliteId} />
        </div>
        
        {/* Command Panel - FIXED HEIGHT AND OVERFLOW LOGIC */}
        <div className="w-[480px] shrink-0 relative z-10 min-h-0 border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.8)] flex flex-col bg-black overflow-hidden">
            {selectedAlert ? (
                <div className="h-full flex flex-col min-h-0 overflow-hidden animate-slideInRight">
                    <AnomalyDetailView 
                        alert={selectedAlert}
                        onBack={() => setSelectedSatelliteId(null)}
                        onArchive={() => handleArchiveAlert(selectedAlert.satellite.NORAD_CAT_ID)}
                        onSaveNotes={handleSaveNotes}
                    />
                </div>
            ) : (
                <DashboardPanel 
                    alerts={alerts} 
                    selectedSatelliteId={selectedSatelliteId} 
                    onSelectSatellite={setSelectedSatelliteId} 
                    onArchiveAlert={handleArchiveAlert} 
                    onOpenArchive={() => setIsArchiveOpen(true)} 
                    onSaveNotes={handleSaveNotes} 
                    filterOptions={filterOptions} 
                    isSystemReady={isAuthenticated} 
                />
            )}
        </div>
      </div>

      <ArchiveModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} archivedAlerts={archivedAlerts} onLoadArchives={(files) => {}} onClearArchives={() => setArchivedAlerts([])} />
      
      {isInvestigationOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-8" onClick={() => setIsInvestigationOpen(false)}>
              <div className="w-full h-full max-w-6xl bg-black border border-white/20 rounded shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-6 border-b border-white/10">
                       <h2 className="text-xl font-bold text-white font-display tracking-[0.3em] uppercase">Tactical Investigation Board</h2>
                       <button onClick={() => setIsInvestigationOpen(false)} className="text-gray-500 hover:text-white p-2">CLOSE X</button>
                  </div>
                  <div className="h-[calc(100%-80px)]"><InvestigationModule /></div>
              </div>
          </div>
      )}
      <style>{`
        .animate-slideInRight { animation: slideInRight 0.25s ease-out; }
        @keyframes slideInRight {
            from { transform: translateX(20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};