import config from '@/config';
import { flux, FluxTableMetaData, QueryApi, WriteApi } from '@influxdata/influxdb-client';
import { Service, Inject } from 'typedi';
import { Logger } from 'winston';

interface NodeQuery {
  start: string;
  stop: string;
  measurements: string[];
  nids?: string[];
  ntype?: string[];
  every?: string;
  fn?: string;
}

@Service()
export default class InfluxService {
  constructor(@Inject('logger') private logger: Logger, @Inject('influxQuery') private query: () => QueryApi) {}

  private buildQuery(q: NodeQuery) {
    const query = [];
    query.push(`|> range(start: ${q.start}, stop: ${q.stop})`);
    if (q.measurements && q.measurements?.length) {
      const subq = q.measurements.map(m => `r["_measurement"] == "${m}"`).join(' or ');
      query.push(`|> filter(fn: (r) => ${subq})`);
    }
    if (q.nids && q.nids?.length) {
      const subq = q.nids.map(m => `r["nodeid"] == "${m}"`).join(' or ');
      query.push(`|> filter(fn: (r) => ${subq})`);
    }
    if (q.ntype && q.ntype?.length) {
      const subq = q.ntype.map(m => `r["ntype"] == "${m}"`).join(' or ');
      query.push(`|> filter(fn: (r) => ${subq})`);
    }
    return query.join('\n');
  }
  private aggregateWindow(q: NodeQuery) {
    const every = q.every ?? '1m';
    const fn = q.fn ?? 'mean';
    const query = `|> aggregateWindow(every: ${every}, fn: ${fn})`;
    return [query, `|> yield(name: "${fn}")`].join('\n');
  }

  async queryNodeData(q: NodeQuery) {
    const query = `
      from(bucket: "${config.influx.bucket}")
        ${this.buildQuery(q)}
        ${this.aggregateWindow(q)}
        |> group(columns: ["nodeid"])
    `;

    const rows = await this.query().collectRows(query);
    return rows;
  }
}
