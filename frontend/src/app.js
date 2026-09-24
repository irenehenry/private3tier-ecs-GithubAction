import React, { useEffect, useState } from 'react';

function App() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        setResponse(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif', 
      maxWidth: '800px', 
      margin: '40px auto', 
      padding: '20px',
      background: '#f8fafc',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ color: '#1e293b' }}>Private 3-Tier App on ECS Fargate</h1>
      <p style={{ color: '#64748b' }}>Frontend → Backend → Redis (primary) / RDS (fallback)</p>

      {loading && <p>Loading data...</p>}
      
      {error && (
        <div style={{ color: 'red', padding: '10px', background: '#fee2e2', borderRadius: '8px' }}>
          Error: {error}
        </div>
      )}

      {response && (
        <div>
          <h3>
            Data Source: 
            <span style={{ 
              color: response.source === 'redis' ? '#16a34a' : '#d97706',
              marginLeft: '8px'
            }}>
              {response.source.toUpperCase()}
            </span>
          </h3>
          <pre style={{ 
            background: '#1e293b', 
            color: '#e2e8f0', 
            padding: '16px', 
            borderRadius: '8px',
            overflow: 'auto'
          }}>
            {JSON.stringify(response.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;