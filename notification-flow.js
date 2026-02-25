import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 concurrent connections
    { duration: '1m', target: 50 },  // Hold
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    ws_connecting: ['p(95)<1000'], // Connection time < 1s
    ws_session_duration: ['p(95)>5000'], // Sessions should last at least 5s
  },
};

const BASE_URL = __ENV.BASE_URL || 'ws://localhost:3000';
const TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export default function () {
  const url = `${BASE_URL}/notifications?token=${TOKEN}`;
  const params = { tags: { my_tag: 'notification-ws' } };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', function open() {
      // console.log('connected');
      
      // Simulate client asking for unread count
      socket.send(JSON.stringify({ event: 'get_unread_count' }));
    });

    socket.on('message', function (message) {
      // console.log(`Received message: ${message}`);
      check(message, { 'received valid json': (m) => m && m.length > 0 });
    });

    socket.on('close', () => console.log('disconnected'));

    // Keep connection open for a bit
    socket.setTimeout(function () {
      socket.close();
    }, 10000);
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}