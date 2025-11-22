// src/components/common/SyncButton.js
import React, { useState } from 'react';
import { syncCurrentUser } from '../../services/auth';

export default function SyncButton() {
    const [loading, setLoading] = useState(false);

    const handleSync = async () => {
        setLoading(true);
        try {
            await syncCurrentUser();
        } catch (error) {
            console.error('Error en sync manual:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSync}
            disabled={loading}
            style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                fontSize: '14px'
            }}
        >
            {loading ? 'Sincronizando...' : 'Sincronizar Usuario'}
        </button>
    );
}
