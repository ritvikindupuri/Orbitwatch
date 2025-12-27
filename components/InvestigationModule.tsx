
import React, { useState, useEffect } from 'react';
import { Investigation } from '../types';
import { investigationService } from '../services/investigationService';

export const InvestigationModule: React.FC = () => {
    const [cases, setCases] = useState<Investigation[]>([]);
    const [selectedCase, setSelectedCase] = useState<Investigation | null>(null);
    const [noteInput, setNoteInput] = useState('');

    useEffect(() => {
        loadCases();
    }, []);

    const loadCases = () => {
        const all = investigationService.getAll();
        setCases(all);
    };

    const handleAddNote = () => {
        if (!selectedCase || !noteInput.trim()) return;
        investigationService.addNote(selectedCase.id, noteInput, 'Operator');
        setNoteInput('');
        loadCases();
        // Refresh selected case
        const updated = investigationService.getById(selectedCase.id);
        if (updated) setSelectedCase(updated);
    };

    const handleCloseCase = () => {
         if (!selectedCase) return;
         investigationService.updateStatus(selectedCase.id, 'Closed');
         loadCases();
         setSelectedCase(null);
    };

    return (
        <div className="flex flex-col h-full bg-gray-900/50">
            {/* Header/Board Logic */}
            {!selectedCase ? (
                <div className="p-4 space-y-4 overflow-y-auto h-full">
                    <h2 className="text-lg font-bold text-gray-100 font-display tracking-wider">Active Investigations</h2>
                    <div className="space-y-2">
                        {cases.filter(c => c.status === 'Open').length === 0 && (
                            <p className="text-gray-500 text-sm">No active investigations.</p>
                        )}
                        {cases.filter(c => c.status === 'Open').map(c => (
                            <div key={c.id} onClick={() => setSelectedCase(c)} className="p-3 bg-gray-800 border-l-4 border-cyan-500 cursor-pointer hover:bg-gray-700 transition-colors">
                                <p className="font-bold text-gray-200">{c.title}</p>
                                <p className="text-xs text-gray-400 mt-1 font-mono">ID: {c.id.slice(0,8)}... | Opened: {new Date(c.dateOpened).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>

                    <h2 className="text-lg font-bold text-gray-100 font-display tracking-wider mt-6">Archives</h2>
                    <div className="space-y-2 opacity-75">
                         {cases.filter(c => c.status === 'Closed').map(c => (
                            <div key={c.id} onClick={() => setSelectedCase(c)} className="p-3 bg-gray-800/50 border-l-4 border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors">
                                <p className="font-bold text-gray-400">{c.title}</p>
                                <p className="text-xs text-gray-500 mt-1 font-mono">Closed: {c.dateClosed ? new Date(c.dateClosed).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-950/30">
                        <button onClick={() => setSelectedCase(null)} className="text-sm text-cyan-400 font-bold uppercase hover:text-cyan-300 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Board
                        </button>
                        <div className="text-right">
                            <span className={`px-2 py-1 text-xs font-bold rounded ${selectedCase.status === 'Open' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' : 'bg-gray-700 text-gray-400'}`}>
                                {selectedCase.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-md">
                            <h3 className="font-bold text-gray-100 text-lg font-display">{selectedCase.title}</h3>
                            <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed border-t border-gray-700/50 pt-2">{selectedCase.description}</p>
                        </div>
                        
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Case Log</p>
                            {selectedCase.notes.length === 0 && <p className="text-sm text-gray-600 italic">No notes recorded.</p>}
                            {selectedCase.notes.map(n => (
                                <div key={n.timestamp} className="text-sm bg-gray-900/50 p-3 rounded border border-gray-800">
                                    <div className="flex justify-between text-[10px] text-cyan-500 font-mono mb-1 uppercase tracking-wide">
                                        <span>{n.author}</span>
                                        <span>{new Date(n.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p className="text-gray-300 leading-snug">{n.content}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    {selectedCase.status === 'Open' && (
                        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
                            <textarea 
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-200 mb-2 focus:ring-1 focus:ring-cyan-500 focus:outline-none resize-none font-mono"
                                placeholder="Add case note or tactical update..."
                                rows={3}
                                value={noteInput}
                                onChange={e => setNoteInput(e.target.value)}
                            />
                            <div className="flex justify-between items-center">
                                <button onClick={handleCloseCase} className="text-rose-400 text-xs font-bold uppercase hover:text-rose-300 transition-colors">Close Investigation</button>
                                <button 
                                    onClick={handleAddNote} 
                                    disabled={!noteInput.trim()}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold uppercase rounded transition-colors shadow-lg"
                                >
                                    Add Entry
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
