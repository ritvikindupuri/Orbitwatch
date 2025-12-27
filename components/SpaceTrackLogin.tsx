import React, { useState } from 'react';
import { APP_NAME } from '../constants';

interface SpaceTrackLoginProps {
    onLogin: (identity: string, password: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

const AppLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        className={className} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M10 50C22.5 25, 77.5 25, 90 50C77.5 75, 22.5 75, 10 50Z" stroke="#00e5ff" strokeWidth="4" strokeOpacity="0.8"/>
        <circle cx="50" cy="50" r="18" stroke="#ffffff" strokeWidth="3"/>
        <ellipse cx="50" cy="50" rx="28" ry="10" stroke="#00e5ff" strokeWidth="2.5" strokeOpacity="0.5"/>
    </svg>
);

export const SpaceTrackLogin: React.FC<SpaceTrackLoginProps> = ({ onLogin, isLoading, error }) => {
    const [identity, setIdentity] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (identity && password) {
            onLogin(identity, password);
        }
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4 font-sans selection:bg-cyan-500/30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,163,204,0.05)_0%,transparent_70%)]"></div>
            
            <div className="relative w-full max-w-md">
                {/* Branding Section */}
                <div className="text-center mb-10">
                    <AppLogo className="h-16 w-16 mx-auto mb-6" />
                    <h1 className="text-5xl font-display font-black text-white tracking-[0.2em] uppercase leading-none">
                        OrbitWatch
                    </h1>
                    <p className="text-[#00e5ff] font-mono text-[10px] uppercase tracking-[0.5em] mt-4 font-bold opacity-80">
                        Space Domain Awareness Platform
                    </p>
                </div>

                {/* Authentication Container */}
                <div className="bg-[#0a0a0a] border border-white/10 rounded-sm shadow-2xl p-10 backdrop-blur-3xl ring-1 ring-white/5">
                    <div className="mb-10 p-5 bg-[#161b22] border border-white/5 rounded-sm">
                        <p className="text-[11px] text-gray-400 text-center leading-relaxed font-sans">
                            Please authenticate with your <strong className="text-white font-bold">Space-Track.org</strong> credentials to ingest live TLE data for <span className="text-cyan-400 font-bold">GEO</span> training sets.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-[0.3em] font-display">Identity / Email</label>
                            <input
                                type="text"
                                value={identity}
                                onChange={(e) => setIdentity(e.target.value)}
                                className="w-full p-4 bg-[#0d1117] text-white border border-white/10 rounded-sm focus:border-cyan-500/50 focus:ring-0 outline-none transition-all placeholder-gray-800 font-mono text-sm tracking-tight"
                                placeholder="user@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-[0.3em] font-display">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 bg-[#0d1117] text-white border border-white/10 rounded-sm focus:border-cyan-500/50 focus:ring-0 outline-none transition-all placeholder-gray-800 font-mono text-sm tracking-tight"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-sm text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-4 mt-4 rounded-sm font-display font-black text-white text-base uppercase tracking-[0.2em] transition-all relative overflow-hidden group
                                ${isLoading 
                                    ? 'bg-gray-900 cursor-wait text-gray-600' 
                                    : 'bg-[#00a3cc] hover:bg-[#00c2f0] shadow-[0_0_25px_rgba(0,163,204,0.4)] hover:shadow-[0_0_35px_rgba(0,163,204,0.6)]'
                                }`}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-4">
                                    <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Synchronizing...
                                </span>
                            ) : (
                                "Initialize System"
                            )}
                        </button>
                    </form>
                </div>
                
                <p className="mt-8 text-[9px] text-gray-700 text-center uppercase tracking-[0.4em] font-mono">
                    Secured Transmission // Peer-to-Peer Encryption
                </p>
            </div>
        </div>
    );
};