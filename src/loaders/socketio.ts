import SocketServer from '@/socketio/socketio';
import Container from 'typedi';
import { Logger } from 'winston';
import { Server } from 'socket.io';

export default ({ io }: { io: Server }) => {
  const logger: Logger = Container.get('logger');
  logger.silly(`SocketServer listening!`);

  io.on('connection', socket => {
    logger.silly(`Client connected to SocketServer: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.silly(`Client disconneted from SocketServer: ${socket.id}`);
    });
  });
};
