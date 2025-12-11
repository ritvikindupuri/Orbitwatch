import React, { useState } from 'react';

export const SpaceTrackLogin = ({ onLogin, isLoading, error }) => {
    const [identity, setIdentity] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(identity, password);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
            <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded shadow-lg w-96">
                <h2 className="text-2xl mb-6 text-center">Login</h2>
                {error && <div className="bg-red-500 text-white p-2 rounded mb-4 text-sm">{error}</div>}
                <div className="mb-4">
                    <label className="block text-gray-400 text-sm mb-2">Identity</label>
                    <input type="text" value={identity} onChange={e => setIdentity(e.target.value)} className="w-full bg-gray-700 rounded p-2 text-white" required />
                </div>
                <div className="mb-6">
                    <label className="block text-gray-400 text-sm mb-2">Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-700 rounded p-2 text-white" required />
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 p-2 rounded hover:bg-blue-500 transition disabled:opacity-50">
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
    );
};
