import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: 'organizer',
  cors: {
    origin: '*',
  },
})
export class OrganizerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrganizerGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-event')
  handleJoinEvent(client: Socket, eventId: string) {
    client.join(`event-${eventId}`);
    this.logger.log(`Client ${client.id} joined event-${eventId}`);
  }

  @SubscribeMessage('leave-event')
  handleLeaveEvent(client: Socket, eventId: string) {
    client.leave(`event-${eventId}`);
    this.logger.log(`Client ${client.id} left event-${eventId}`);
  }

  sendUpdate(eventId: string, type: string, data: any) {
    this.server.to(`event-${eventId}`).emit(type, data);
  }
}
