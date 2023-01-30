import { EventSubscriber, On } from 'event-dispatch';
import { Server } from 'socket.io';
import Container from 'typedi';
import { default as localEvents } from './events';
import { default as socketEvents } from '@/socketio/events';

@EventSubscriber()
export default class SystemSubscriber {
  @On(localEvents.system.onUpdateState)
  public onUpdate(state) {
    const io: Server = Container.get('io');
    io.emit(socketEvents.system.stateUpdated, state);
  }
}
