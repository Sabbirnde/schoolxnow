import React from 'react';

const TestPage: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#4a4a4a' }}>Test Page</h1>
      <p style={{ fontSize: '18px' }}>If you can see this text, React is working correctly.</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
      <button 
        style={{ 
          padding: '10px 15px', 
          backgroundColor: '#4CAF50', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={() => alert('Button clicked!')}
      >
        Click Me
      </button>
    </div>
  );
};

export default TestPage;
