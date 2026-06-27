import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Core Interfaces
interface CheckInRecord {
  id: string;
  attendeeName: string;
  ticketId: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
}

export const QRScannerDashboard: React.FC = () => {
  // 1. State Management
  const [scanResult, setScanResult] = useState<{ status: 'SUCCESS' | 'FAILED' | 'SCANNING'; message: string } | null>({
    status: 'SCANNING',
    message: 'Align a ticket QR code within the frame to process check-in.',
  });
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [isCameraAuthorized, setIsCameraAuthorized] = useState<boolean | null>(null);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // 2. Initialize Scanner Engine
  useEffect(() => {
    // Request permission explicitly by probing media tracks
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(() => {
        setIsCameraAuthorized(true);
        initializeScanner();
      })
      .catch(() => {
        setIsCameraAuthorized(false);
        setScanResult({
          status: 'FAILED',
          message: 'Camera permission denied. Staff must allow camera access to scan attendee codes.',
        });
      });

    return () => {
      // Memory Leak Prevention: Explicitly teardown interval streams and camera locks on unmount
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => console.error('Failed to clear scanner fallback', err));
      }
    };
  }, []);

  const initializeScanner = () => {
    // Instantiate with optimal scanning windows for mobile aspect ratios
    scannerRef.current = new Html5QrcodeScanner(
      'qr-reader-target',
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );

    scannerRef.current.render(onScanSuccess, onScanFailure);
  };

  // 3. Process Captured Scans
  const onScanSuccess = async (decodedText: string) => {
    // Play subtle haptic/audio confirmation if supported natively
    if (navigator.vibrate) navigator.vibrate(100);

    // Prevent immediate repeated scanning processing bursts
    if (scannerRef.current) {
      scannerRef.current.pause(true);
    }

    setScanResult({ status: 'SCANNING', message: 'Verifying cryptographic ticket anchors...' });

    try {
      // Mock API routing resolution pipeline execution
      // const res = await fetch(`/api/events/checkin`, { method: 'POST', body: JSON.stringify({ ticketId: decodedText }) });
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Simulate a sample failure outcome for validation purposes
      if (decodedText.toLowerCase().includes('expired')) {
        throw new Error('Ticket Invalid: This code has already been scanned.');
      }

      const mockRecord: CheckInRecord = {
        id: Math.random().toString(36).substr(2, 9),
        attendeeName: decodedText.length > 15 ? "Verified VIP Attendee" : `User: ${decodedText}`,
        ticketId: decodedText,
        timestamp: new Date().toLocaleTimeString(),
        status: 'SUCCESS',
        message: 'Access Granted — Welcome to the event!',
      };

      setScanResult({ status: 'SUCCESS', message: mockRecord.message });
      setHistory((prev) => [mockRecord, ...prev]);

    } catch (error: any) {
      const failedRecord: CheckInRecord = {
        id: Math.random().toString(36).substr(2, 9),
        attendeeName: 'Unknown/Invalid Token',
        ticketId: decodedText,
        timestamp: new Date().toLocaleTimeString(),
        status: 'FAILED',
        message: error.message || 'Verification Error.',
      };

      setScanResult({ status: 'FAILED', message: failedRecord.message });
      setHistory((prev) => [failedRecord, ...prev]);
    } finally {
      // Resume scanner camera feed loop after a 2-second visibility delay
      setTimeout(() => {
        if (scannerRef.current) {
          scannerRef.current.resume();
          setScanResult({ status: 'SCANNING', message: 'Align a ticket QR code within the frame to process check-in.' });
        }
      }, 2000);
    }
  };

  const onScanFailure = (error: any) => {
    // Continuous passive background frame degradation errors can be safely ignored 
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-12">
        
        {/* Left Column: Heading & Live Camera Scanner Pipeline */}
        <div className="md:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Staff Check-in Dashboard</h1>
            <p className="text-xs text-gray-500 mt-1">Event Gates Operational Mode</p>
            
            {/* Camera View Anchor Wrapper */}
            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-black aspect-square max-w-md mx-auto relative">
              {isCameraAuthorized === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white space-y-3 z-10 bg-gray-900">
                  <span className="text-3xl">🚫</span>
                  <p className="text-sm font-semibold">Camera Access Blocked</p>
                </div>
              )}
              <div id="qr-reader-target" className="w-full h-full" />
            </div>
          </div>

          {/* Real-time Dynamic Feedback Banner Card */}
          {scanResult && (
            <div className={`p-5 rounded-xl border transition-all duration-300 flex items-start space-x-3 ${
              scanResult.status === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              scanResult.status === 'FAILED' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <span className="text-xl mt-0.5">
                {scanResult.status === 'SUCCESS' ? '✅' : scanResult.status === 'FAILED' ? '❌' : '📡'}
              </span>
              <div>
                <h4 className="font-bold uppercase tracking-wider text-xs">
                  Scanner Status: {scanResult.status}
                </h4>
                <p className="text-sm font-medium mt-1 leading-relaxed">{scanResult.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Mobile-Responsive Check-In History Panel */}
        <div className="md:col-span-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-[calc(100vh-4rem)] md:h-[550px]">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h3 className="font-bold text-gray-900 text-base">Check-In Log History</h3>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
              {history.length} Processed
            </span>
          </div>

          {/* Auto-scrolling Scroll Area Context */}
          <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
            {history.length > 0 ? (
              history.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    item.status === 'SUCCESS' ? 'border-emerald-100 bg-emerald-50/40' : 'border-rose-100 bg-rose-50/40'
                  }`}
                >
                  <div className="space-y-1 max-w-[70%]">
                    <p className="font-semibold text-gray-900 truncate">{item.attendeeName}</p>
                    <p className="font-mono text-gray-400 truncate tracking-tight">{item.ticketId}</p>
                  </div>
                  <div className="text-right flex flex-col items-end space-y-1">
                    <span className="text-gray-400 font-medium">{item.timestamp}</span>
                    <span className={`px-1.5 py-0.5 font-bold rounded uppercase tracking-wide text-[10px] ${
                      item.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12 space-y-2">
                <span className="text-2xl">📋</span>
                <p className="text-xs">No entries recorded during this gate session.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};