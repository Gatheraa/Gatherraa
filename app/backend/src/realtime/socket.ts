import { RealtimeEvent, RealtimeListener } from './events';

class RealtimeService {
  private socket: WebSocket | null = null;
  private listeners: RealtimeListener[] = [];
  private reconnectAttempts = 0;
  private heartbeatInterval: any = null;
  private pollingInterval: any = null;

  private WS_URL = process.env.NODE_ENV || 'ws://localhost:4000';

  connect() {
    this.socket = new WebSocket(this.WS_URL);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.stopPolling();
    };

    this.socket.onmessage = (event) => {
      const data: RealtimeEvent = JSON.parse(event.data);
      this.notify(data);
    };

    this.socket.onerror = () => {
      console.error('WebSocket error');
    };

    this.socket.onclose = () => {
      console.warn('WebSocket disconnected');
      this.stopHeartbeat();
      this.tryReconnect();
      this.startPollingFallback();
    };
  }

  private notify(event: RealtimeEvent) {
    this.listeners.forEach((listener) => listener(event));
  }

  subscribe(listener: RealtimeListener) {
    this.listeners.push(listener);
  }

  unsubscribe(listener: RealtimeListener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  send(data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  // ===============================
  // Auto Reconnect Strategy
  // ===============================

  private tryReconnect() {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`Reconnecting attempt ${this.reconnectAttempts}`);
      this.connect();
    }, delay);
  }

  // ===============================
  // Heartbeat Monitoring
  // ===============================

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'PING' });
    }, 10000);
  }

  private stopHeartbeat() {
    clearInterval(this.heartbeatInterval);
  }

  // ===============================
  // Polling Fallback
  // ===============================

  private startPollingFallback() {
    if (this.pollingInterval) return;

    console.warn('Starting polling fallback');

    this.pollingInterval = setInterval(async () => {
      const res = await fetch('/api/dashboard/updates');
      const data = await res.json();

      data.forEach((event: RealtimeEvent) => this.notify(event));
    }, 15000);
  }

  private stopPolling() {
    clearInterval(this.pollingInterval);
    this.pollingInterval = null;
  }
}

export const realtimeService = new RealtimeService();
