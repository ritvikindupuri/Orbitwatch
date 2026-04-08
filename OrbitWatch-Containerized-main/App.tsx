import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as satellite from 'satellite.js';
import { AnomalyAlert, RealSatellite, ForensicEvidence, Investigation } from './types';
import { Header } from './components/Header';
import { GlobalStatsBar } from './components/GlobalStatsBar';
import { DashboardPanel } from './components/DashboardPanel';
import MapDisplay from './components/MapDisplay';
import { ArchiveModal } from './components/ArchiveModal';
import { fetchSatelliteCatalog, checkRelayHealth, RelayHealthStatus } from './services/satelliteData';
import { generateAnomalyAnalysis, trainModelOnCatalog } from './services/tensorFlowService';
import { dbService } from './services/databaseService';
import { relayService } from './services/relayService';
import { ClassificationBanner } from './components/ClassificationBanner';
import { investigationService } from './services/investigationService';
import { InvestigationModule } from './components/InvestigationModule';
import { AnomalyDetailView } from './components/AnomalyDetailView';

const MU = 398600.4418;
const EARTH_RADIUS = 6371.0;
const SPEED_OF_LIGHT = 299792.458;

export const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [satelliteCatalog, setSatelliteCatalog] = useState<RealSatellite[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [archivedAlerts, setArchivedAlerts] = useState<AnomalyAlert[]>([]);
  const [isAnalysisActive, setIsAnalysisActive] = useState(true);

  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isInvestigationOpen, setIsInvestigationOpen] = useState(false);

  // Investigation state — lifted here so InvestigationModule stays reactive
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [newCaseId, setNewCaseId] = useState<string | null>(null);
  const [commitState, setCommitState] = useState<'idle' | 'committing' | 'success' | 'error'>('idle');
  const [commitError, setCommitError] = useState<string | null>(null);

  // Relay / ES health
  const [esStatus, setEsStatus] = useState<RelayHealthStatus>('offline');

  // Initialize databases and load investigations
  useEffect(() => {
    dbService.init().catch(console.error);
    investigationService.init()
      .then(() => setInvestigations([...investigationService.getAll()]))
      .catch(console.error);
  }, []);

  const refreshInvestigations = useCallback(() => {
    setInvestigations([...investigationService.getAll()]);
  }, []);

  // Poll ES health every 60s
  useEffect(() => {
    const poll = async () => {
      const status = await checkRelayHealth();
      setEsStatus(status);
    };
    const interval = setInterval(poll, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fetch satellite data from Elasticsearch on startup
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        setLoadingMessage('Establishing Relay Link...');

        // Check relay health and store result
        const initialHealth = await checkRelayHealth();
        setEsStatus(initialHealth);
        if (initialHealth !== 'healthy') {
          console.warn('[App] Relay unavailable, will use fallback data');
        }

        setLoadingMessage('Fetching Satellite Catalog from Elasticsearch...');

        // Fetch satellite data (GEO belt only)
        const catalog = await fetchSatelliteCatalog(true, 300);
        setSatelliteCatalog(catalog);

        // Save to local database
        await dbService.saveSnapshot(catalog);

        setLoadingMessage('Querying Historical GEO Data Lake...');

        // Train ML models
        const trainingSet = await dbService.getTrainingDataset(5);
        await trainModelOnCatalog(trainingSet, (msg) => setLoadingMessage(msg));

        // Dispatch telemetry to relay
        relayService.dispatchTelemetry(catalog);

        setLastSyncTime(Date.now());
        setIsLoading(false);
        setIsReady(true);
        setIsAnalysisActive(true);

      } catch (error) {
        console.error('[App] Initialization failed:', error);
        setLoadError(error instanceof Error ? error.message : 'Initialization failed');
        setIsLoading(false);
      }
    };

    initializeSystem();
  }, []);

  // Manual sync handler
  const handleSync = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const catalog = await fetchSatelliteCatalog(true, 300);
      setSatelliteCatalog(catalog);
      await dbService.saveSnapshot(catalog);
      relayService.dispatchTelemetry(catalog);
      setLastSyncTime(Date.now());
    } catch (error) {
      console.error('[App] Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Run anomaly analysis
  useEffect(() => {
    const runScan = async () => {
      if (!isAnalysisActive || !isReady || satelliteCatalog.length === 0) return;
      const newAlerts: AnomalyAlert[] = [];
      const batch = satelliteCatalog.slice(0, 100);
      for (const sat of batch) {
        try {
          const analysis = await generateAnomalyAnalysis(sat);
          if (analysis.riskScore > 35) {
            newAlerts.push({ satellite: sat, analysisState: 'complete', details: analysis, timestamp: Date.now() });
          }
        } catch (e) { }
      }
      setAlerts(newAlerts.sort((a, b) => (b.details?.riskScore || 0) - (a.details?.riskScore || 0)));
    };
    runScan();
  }, [isAnalysisActive, satelliteCatalog, isReady]);

  const handleSelectSatellite = useCallback((id: number | null) => {
    setSelectedSatelliteId(id);
    if (id !== null) setIsSidebarOpen(true);
  }, []);

  const handleArchiveAlert = useCallback(async (satelliteId: number) => {
    const alert = alerts.find(a => a.satellite.NORAD_CAT_ID === satelliteId);
    if (!alert || !alert.details) return;

    setCommitState('committing');
    setCommitError(null);

    try {
      const satrec = satellite.twoline2satrec(alert.satellite.TLE_LINE1, alert.satellite.TLE_LINE2);
      const posVel = satellite.propagate(satrec, new Date());
      const gmst = satellite.gstime(new Date());
      const gd = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
      const velocity = Math.sqrt(Math.pow(posVel.velocity.x, 2) + Math.pow(posVel.velocity.y, 2) + Math.pow(posVel.velocity.z, 2));
      const meanMotionSec = satrec.no / 60;
      const sma = Math.pow(MU / Math.pow(meanMotionSec, 2), 1 / 3);
      const isJamming = alert.details.riskScore > 70;
      const baseFreq = 2.245;
      const centerFreq = baseFreq + (baseFreq * (velocity / SPEED_OF_LIGHT));
      const spectrumSnapshot = [];
      for (let i = 0; i < 50; i++) {
        const offset = (i - 25) * 0.0002;
        const noise = (isJamming ? -85 : -112) + (Math.random() * 5);
        const signal = Math.exp(-Math.pow(offset, 2) / 0.000000006) * 75;
        spectrumSnapshot.push({ freq: (centerFreq + offset).toFixed(6), power: Math.max(noise, noise + signal) });
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

      const result = await investigationService.create(
        `Forensic Case: ${alert.satellite.OBJECT_NAME}`,
        `Attribution: ${alert.details.description}`,
        satelliteId,
        alert.satellite.OBJECT_NAME,
        evidence
      );

      // Push forensic commitment to the multi-operator hub
      relayService.dispatchForensics(satelliteId, alert.satellite.OBJECT_NAME, evidence);

      // Refresh lifted investigation state
      setInvestigations([...investigationService.getAll()]);

      if (result.relayOk) {
        setCommitState('success');
      } else {
        setCommitState('error');
        setCommitError(result.error || 'Relay offline');
      }

      // After brief button feedback: clear the anomaly view and open the new dossier
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.satellite.NORAD_CAT_ID !== satelliteId));
        setSelectedSatelliteId(null);
        setNewCaseId(result.investigation.id);
        setIsInvestigationOpen(true);
        setCommitState('idle');
        setCommitError(null);
      }, 1200);

    } catch (e: unknown) {
      setCommitState('error');
      setCommitError(e instanceof Error ? e.message : 'Unexpected error');
    }
  }, [alerts]);

  const selectedAlert = useMemo(() => {
    return alerts.find(s => s.satellite.NORAD_CAT_ID === selectedSatelliteId) || null;
  }, [selectedSatelliteId, alerts]);

  const filterOptions = useMemo(() => {
    const countries = [...new Set(
      alerts.map(a => a.satellite.OWNER).filter(o => o && o !== 'Unknown')
    )].sort();
    const types = [...new Set(
      alerts.map(a => a.satellite.OBJECT_TYPE).filter(t => t && t !== 'Unknown')
    )].sort();
    return { countries, types };
  }, [alerts]);

  // Loading screen
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

  // Error screen
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="text-red-500 text-6xl mb-6">!</div>
        <p className="text-xl font-mono text-red-400 font-display tracking-[0.2em] uppercase mb-4">System Initialization Failed</p>
        <p className="text-gray-400 font-mono text-sm mb-8">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-cyan-900/50 border border-cyan-500 text-cyan-400 font-mono text-sm uppercase tracking-widest hover:bg-cyan-900 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden text-gray-100 font-sans">
      <ClassificationBanner />
      <Header onClearSession={() => { dbService.clearDatabase(); window.location.reload(); }} isDemoMode={false} onOpenInvestigations={() => setIsInvestigationOpen(true)} />
      <GlobalStatsBar alerts={alerts} satelliteCount={satelliteCatalog.length} lastSyncTime={lastSyncTime} isSyncing={isSyncing} onSync={handleSync} esStatus={esStatus} />

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
              onSaveNotes={() => { }}
              commitState={commitState}
              commitError={commitError}
            />
          ) : (
            <DashboardPanel
              alerts={alerts}
              selectedSatelliteId={selectedSatelliteId}
              onSelectSatellite={setSelectedSatelliteId}
              onArchiveAlert={handleArchiveAlert}
              onOpenArchive={() => setIsArchiveOpen(true)}
              onSaveNotes={() => { }}
              filterOptions={filterOptions}
              isSystemReady={isReady}
              onClose={() => setIsSidebarOpen(false)}
            />
          )}
        </div>
      </div>

      <ArchiveModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} archivedAlerts={archivedAlerts} onLoadArchives={() => { }} onClearArchives={() => setArchivedAlerts([])} />

      {isInvestigationOpen && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-8"
          onClick={() => { setIsInvestigationOpen(false); setNewCaseId(null); }}
        >
          <div className="w-full h-full max-w-7xl bg-black border border-white/20 rounded-sm shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/[0.02]">
              <h2 className="text-xl font-bold text-white font-display tracking-[0.3em] uppercase">Tactical Forensic Investigation Suite</h2>
              <button
                onClick={() => { setIsInvestigationOpen(false); setNewCaseId(null); }}
                className="text-gray-500 hover:text-white font-mono text-xs uppercase tracking-widest px-4 py-2 border border-white/10 rounded-sm"
              >
                EXIT [ESC]
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <InvestigationModule
                cases={investigations}
                initialSelectedId={newCaseId}
                onCasesUpdated={refreshInvestigations}
                activeAlerts={alerts}
                onCreateFromAnomaly={handleArchiveAlert}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
