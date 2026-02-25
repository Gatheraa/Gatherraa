import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 concurrent connections
    { duration: '1m', target: 50 },  // Hold
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    'ws_connecting_duration': ['p(95)<1000'], // Connection time < 1s
  }
};

export default function () {
  const url = 'ws://localhost:3000/notifications';
  // Assuming JWT auth via query param or handshake
  const params = { 
    tags: { my_tag: 'notification_test' },
    headers: { 'Authorization': 'Bearer test-token' }
  };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', function open() {
      // Keep connection alive
      socket.setInterval(function timeout() {
        socket.ping();
      }, 1000);
    });

    socket.on('close', function () {
      // console.log('disconnected');
    });

    socket.setTimeout(function () {
      socket.close();
    }, 5000); // Keep open for 5 seconds
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
  sleep(1);
}