import { useState, useEffect } from 'react';

export default function Home() {
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    fetch('/api/v1/status')
      .then(res => res.json())
      .then(data => setStatus(data.service))
      .catch(err => setStatus('Error connecting to backend'));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Mini CRM
        </h1>
        <div className="text-center">
          <p className="text-gray-600 mb-2">Frontend Status: ✅ Running</p>
          <p className="text-gray-600">Backend Status: {status}</p>
        </div>
      </div>
    </div>
  );
}
