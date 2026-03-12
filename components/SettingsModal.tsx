import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Database, Shield, Globe, CheckCircle2, AlertTriangle } from 'lucide-react';
import { relayService } from '../services/relayService.ts';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfigUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onConfigUpdated }) => {
    const [config, setConfig] = useState({
        url: '',
        username: 'elastic',
        password: ''
    });
    const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            const loadConfig = async () => {
                const existing = await relayService.getConfig();
                if (existing) {
                    setConfig(prev => ({
                        ...prev,
                        url: existing.url || '',
                        username: existing.username || 'elastic',
                        // We don't set password from backend for security, 
                        // but we can indicate it exists in the UI if needed.
                    }));
                }
            };
            loadConfig();
        }
    }, [isOpen]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('testing');
        setErrorMessage('');

        const success = await relayService.configure(config);
        
        if (success) {
            setStatus('success');
            setTimeout(() => {
                onConfigUpdated();
                onClose();
                setStatus('idle');
            }, 1500);
        } else {
            setStatus('error');
            // Try to get a more specific error message if possible
            try {
                const response = await fetch('http://localhost:3000/v1/configure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                const data = await response.json();
                setErrorMessage(data.message || 'Failed to establish intelligence link. Please check your credentials and URL.');
            } catch (e) {
                setErrorMessage('Failed to establish intelligence link. Please check your credentials and URL.');
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-lg shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                            <div className="flex items-center space-x-3">
                                <Database className="w-5 h-5 text-cyan-400" />
                                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white font-display">
                                    Intelligence Configuration
                                </h2>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-display">
                                        Intelligence Link URL
                                    </label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                        <input 
                                            type="url"
                                            required
                                            placeholder="https://your-cluster.es.us-east-1.aws.found.io:9243"
                                            className="w-full bg-black border border-white/10 rounded p-2 pl-10 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                                            value={config.url}
                                            onChange={e => setConfig({...config, url: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-display">
                                            Username
                                        </label>
                                        <input 
                                            type="text"
                                            required
                                            className="w-full bg-black border border-white/10 rounded p-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                                            value={config.username}
                                            onChange={e => setConfig({...config, username: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-display">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                            <input 
                                                type="password"
                                                required
                                                className="w-full bg-black border border-white/10 rounded p-2 pl-10 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                                                value={config.password}
                                                onChange={e => setConfig({...config, password: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {status === 'error' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 bg-red-500/10 border border-red-500/20 rounded flex items-start space-x-3"
                                >
                                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-red-400 leading-tight">{errorMessage}</p>
                                </motion.div>
                            )}

                            {status === 'success' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 bg-green-500/10 border border-green-500/20 rounded flex items-center space-x-3"
                                >
                                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                    <p className="text-[11px] text-green-400">Intelligence Link Established Successfully.</p>
                                </motion.div>
                            )}

                            <button
                                type="submit"
                                disabled={status === 'testing' || status === 'success'}
                                className={`w-full py-3 rounded text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${
                                    status === 'testing' 
                                        ? 'bg-zinc-800 text-gray-500 cursor-wait' 
                                        : status === 'success'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20'
                                }`}
                            >
                                {status === 'testing' ? 'Verifying Link...' : status === 'success' ? 'Link Active' : 'Establish Intelligence Link'}
                            </button>
                        </form>

                        <div className="p-6 bg-white/5 border-t border-white/5">
                            <p className="text-[10px] text-gray-500 leading-relaxed italic">
                                * Credentials are stored in memory for the current session. Ensure your intelligence link allows inbound traffic from this environment.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
