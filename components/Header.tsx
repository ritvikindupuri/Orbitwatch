import React from 'react';

export const Header = ({ onClearSession, isDemoMode }) => (
    <div className="p-4 bg-gray-800 text-white flex justify-between">
        <h1 className="text-xl font-bold">OrbitWatch</h1>
        <button onClick={onClearSession} className="bg-red-500 px-3 py-1 rounded">Logout</button>
    </div>
);
