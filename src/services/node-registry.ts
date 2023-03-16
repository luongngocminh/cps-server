import { INode } from '@/models/node';
import { getNodeKey } from '@/utils';
import { Inject, Service } from 'typedi';
import { Logger } from 'winston';
import { Server } from 'socket.io';
import events from '@/socketio/events';
import _ from 'lodash';

const WINDOWTMS = 5000; // 1 second
const SESSIONTMS = 5 * 60 * 1000; // 5 min
const NODETIMEOUT = 60 * 60 * 1000; // 1hour

class ObservableMap<K, T> extends Map {
  setHandler: (v: ObservableMap<K, T>) => void;
  constructor(setHandler: (v: ObservableMap<K, T>) => void) {
    super();
    this.setHandler = setHandler;
  }

  set(key: K, value: T) {
    super.set(key, value);
    this.setHandler(this);
    return this;
  }
}

Service();
export default class NodeRegistryService {
  private nodes: ObservableMap<string, INode>;
  private nodeTimer: Map<string, NodeJS.Timeout>;

  private sessionFlag = false;
  private windowFlag = false;

  private _sessionTimer: NodeJS.Timeout;
  private _windowTimer: NodeJS.Timeout;

  private temporaryNodesRegister: Map<string, INode>;
  constructor(
    @Inject('nodeModel') private nodeModel: Models.NodeModel,
    @Inject('logger') private logger: Logger,
    @Inject('io') private io: Server,
  ) {
    this.init();
  }

  emitChangesDebounce = _.debounce(map => {
    this.io.emit(events.node.registryUpdated, Object.fromEntries(map));
  }, 1000);

  onRegistryChanged = (map: Map<string, INode>) => {
    this.emitChangesDebounce(map);
  };

  async init() {
    this.nodes = new ObservableMap<string, INode>(this.onRegistryChanged);
    this.nodeTimer = new Map<string, NodeJS.Timeout>();
    this.temporaryNodesRegister = new Map<string, INode>();
    // populate the memory registry with data from mongodb
    const nodes = await this.nodeModel.find({}).lean().exec();
    for (const node of nodes) {
      this.add(node);
    }
    this.logger.debug('Node registry initialized, current nodes: %o', nodes);
  }

  getAll() {
    return [...this.nodes].map(([_, value]) => value);
  }

  add(node: INode) {
    const key = getNodeKey(node.nid, node.type);

    if (this.nodes.has(key)) {
      this.logger.warn('Potentially duplicated node: %s', key);
    }
    // Set timer
    this.nodes.set(key, node);
    this.nodeTimer.set(
      key,
      setTimeout(() => {
        const node = this.nodes.get(key);
        this.nodes.set(key, { ...node, status: 1 }); // disconnected
        this.logger.warn(`Node ${key} has not response in an hour, disconnecting...`);
      }, NODETIMEOUT),
    );
  }

  simpleUpdate(node: INode) {
    const key = getNodeKey(node.nid, node.type);
    if (!this.nodes.has(key)) {
      return this.logger.warn('Unregistered node encountered: %s', key);
    }
    this.nodes.set(key, node);
  }

  update(node: INode) {
    const key = getNodeKey(node.nid, node.type);
    if (!this.nodes.has(key)) {
      return this.logger.warn('Unregistered node encountered: %s', key);
    }
    if (!this.sessionFlag) {
      // Initialize a new info session
      this.sessionFlag = true;
      this.windowFlag = true;
      this._sessionTimer = setTimeout(this.endSession.bind(this), SESSIONTMS);
      this._windowTimer = setTimeout(this.endWindow.bind(this), WINDOWTMS);
    } else {
      if (!this.windowFlag) {
        // Out of given time frame => drifted too far
        this.logger.warn('A node health check info has arrived outside of given timeframe: %s', key);
        node.status = 3; // Out of Sync

        // TODO: Set System status to be Errored
      }
    }
    this.temporaryNodesRegister.set(key, node);
    this.nodes.set(key, node);
    if (this.temporaryNodesRegister.size === this.nodes.size) {
      this.endWindow();
      this.endSession();
    }
    this.nodeTimer.get(key).refresh();
  }

  private endSession() {
    this.logger.debug('INFO Session ended');
    if (this._sessionTimer) {
      clearTimeout(this._sessionTimer);
    }
    this.temporaryNodesRegister.clear();
    this.sessionFlag = false;
  }

  private endWindow() {
    this.logger.debug('INFO Window ended');
    if (this._windowTimer) {
      clearTimeout(this._windowTimer);
    }

    this.windowFlag = false;
    if (this.temporaryNodesRegister.size < this.nodes.size) {
      const faultyNodes = [...this.nodes.entries()].filter(([key, value]) => !this.temporaryNodesRegister.has(key));
      this.logger.error('Some nodes are not able to checkin in the given time frame: %o', faultyNodes);
      for (const node of faultyNodes) {
        node[1].status = 2; // failed
        this.nodes.set(node[0], node[1]);
      }
      // TODO: Set System status to be Errored
    }
  }

  get(nid: number, type: number) {
    const key = getNodeKey(nid, type);
    return this.nodes.get(key);
  }

  delete(nid: number, type: number) {
    const key = getNodeKey(nid, type);
    if (this.nodes.has(key)) {
      this.nodes.delete(key);
    }
  }
}
