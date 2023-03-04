import config from '@/config';
import { InfluxDB, QueryApi, WriteApi } from '@influxdata/influxdb-client';

const query = (): QueryApi => {
  return new InfluxDB({ url: config.influx.url, token: config.influx.token }).getQueryApi(config.influx.org);
};

const write = (): WriteApi => {
  return new InfluxDB({ url: config.influx.url, token: config.influx.token }).getWriteApi(
    config.influx.org,
    config.influx.bucket,
  );
};

export default {
  query,
  write,
};
