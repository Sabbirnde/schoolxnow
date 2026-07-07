import React, { useEffect, useState } from 'react';
import SecureConfig from '@/lib/secure-config';

const ConfigDebugger: React.FC = () => {
  const [configState, setConfigState] = useState<{
    isValid: boolean;
    errors: string[];
    safeInfo: Record<string, string>;
  } | null>(null);

  const [envVariables, setEnvVariables] = useState<{
    apiUrl?: string;
    mode?: string;
    isDev?: boolean;
  }>({});

  useEffect(() => {
    const validation = SecureConfig.validate();
    setConfigState(validation);
    setEnvVariables({
      apiUrl: import.meta.env.VITE_API_URL ? '[Set]' : '[Not Set]',
      mode: import.meta.env.MODE,
      isDev: import.meta.env.DEV,
    });
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Configuration Debugger</h1>

      <h2>Environment Variables Status:</h2>
      <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
        {JSON.stringify(envVariables, null, 2)}
      </pre>

      {configState && (
        <>
          <h2>Config Validation Result:</h2>
          <div
            style={{
              backgroundColor: configState.isValid ? '#e8f5e9' : '#ffebee',
              padding: '15px',
              borderRadius: '5px',
              marginBottom: '20px',
            }}
          >
            <p style={{ fontWeight: 'bold' }}>Status: {configState.isValid ? 'Valid' : 'Invalid'}</p>

            {configState.errors.length > 0 && (
              <>
                <h3>Errors:</h3>
                <ul>
                  {configState.errors.map((error) => (
                    <li key={error} style={{ color: '#d32f2f' }}>
                      {error}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3>Safe Configuration Info:</h3>
            <ul>
              {Object.entries(configState.safeInfo).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {value}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <h2>Troubleshooting Steps:</h2>
      <ol>
        <li>Verify that <code>.env</code> file exists in project root.</li>
        <li>Check that it contains <code>VITE_API_URL</code>.</li>
        <li>Restart the development server after changing <code>.env</code>.</li>
        <li>Make sure the PHP API is reachable.</li>
      </ol>
    </div>
  );
};

export default ConfigDebugger;
