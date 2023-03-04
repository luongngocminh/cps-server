// import { EventSubscriber, On } from 'event-dispatch';
// import { Server } from 'socket.io';
// import Container from 'typedi';
// import { default as localEvents } from './events';
// import { default as socketEvents } from '@/socketio/events';
// import { INode } from '@/models/node';
//
// @EventSubscriber()
// export default class NodeEventsSubscriber {
//   @On(localEvents.node.onUpdateState)
//   public onUpdate(state: { [key: string]: INode }) {
//     const io: Server = Container.get('io');
//     io.emit(socketEvents.node.registryUpdated, state);
//     console.log('emitting', state)
//   }
// }
