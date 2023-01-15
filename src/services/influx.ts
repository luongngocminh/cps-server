import { QueryApi, WriteApi } from '@influxdata/influxdb-client';
import { Service, Inject } from 'typedi';
import { Logger } from 'winston';

@Service()
export default class InfluxService {
  constructor(
    @Inject('logger') private logger: Logger,
    @Inject('influxQuery') private query: QueryApi,
    @Inject('influxWrite') private write: WriteApi,
  ) {}
}
