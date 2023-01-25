import { INode } from '@/models/node';
import { getNodeKey } from '@/utils';
import { Inject, Service } from 'typedi';
import { Logger } from 'winston';

Service();
export default class NodeRegistryService {
  private nodes: Map<string, INode>;
  constructor(@Inject('nodeModel') private nodeModel: Models.NodeModel, @Inject('logger') private logger: Logger) {
    this.init();
  }

  async init() {
    this.nodes = new Map<string, INode>();
    // populate the memory registry with data from mongodb
    const nodes = await this.nodeModel.find({});
    for (const node of nodes) {
      this.add(node);
    }
    this.logger.debug('Node registry initialized, current nodes: %o', nodes);
  }

  getAll() {
    return this.nodes.values();
  }

  add(data: INode) {
    const key = getNodeKey(data.nid, data.type);
    if (this.nodes.has(key)) {
      this.logger.warn('Potentially duplicated node: %s', key);
      return this.update(data);
    }
    this.nodes.set(key, data);
  }

  update(data: INode) {
    const key = getNodeKey(data.nid, data.type);
    if (!this.nodes.has(key)) {
      return this.logger.warn('Unregistered node encountered: %s', key);
    }
    this.nodes.set(key, data);
  }

  delete(nid: number, type: number) {
    const key = getNodeKey(nid, type);
    if (this.nodes.has(key)) {
      this.nodes.delete(key);
    }
  }
}
