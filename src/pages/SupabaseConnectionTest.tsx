import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SupabaseConnectionTest: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionDetails, setConnectionDetails] = useState<any>(null);

  useEffect(() => {
    async function checkConnection() {
      try {
        console.log('Testing Supabase connection...');
        
        // Test if we can connect to Supabase with a simple query
        const { data, error } = await supabase.from('schools').select('count').limit(1);
        
        if (error) {
          console.error('Supabase connection error:', error);
          setStatus('error');
          setErrorMessage(error.message);
          return;
        }
        
        // If we got here, connection is working
        console.log('Supabase connection successful!', data);
        setStatus('connected');
        setConnectionDetails({
          response: data,
          timestamp: new Date().toISOString(),
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'Not set',
          authStatus: supabase.auth ? 'Initialized' : 'Not initialized',
        });
      } catch (err) {
        console.error('Error testing Supabase connection:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    }

    checkConnection();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Supabase Connection Test</h1>
      
      {status === 'checking' && (
        <p style={{ color: '#0057b7' }}>Checking Supabase connection...</p>
      )}
      
      {status === 'connected' && (
        <div>
          <p style={{ color: '#4CAF50' }}>✅ Supabase connection successful!</p>
          {connectionDetails && (
            <pre style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '5px',
              overflow: 'auto'
            }}>
              {JSON.stringify(connectionDetails, null, 2)}
            </pre>
          )}
        </div>
      )}
      
      {status === 'error' && (
        <div>
          <p style={{ color: '#f44336' }}>❌ Supabase connection failed</p>
          <p style={{ fontWeight: 'bold' }}>Error: {errorMessage}</p>
          <div style={{ marginTop: '20px' }}>
            <h3>Troubleshooting Steps:</h3>
            <ol>
              <li>Check if your Supabase URL and anon key are correct in .env file</li>
              <li>Verify that your Supabase project is online</li>
              <li>Check for any network connectivity issues</li>
              <li>Ensure the 'get_server_version' function exists in your Supabase database</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupabaseConnectionTest;
