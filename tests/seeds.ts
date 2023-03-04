import config from '../src/config';
import subHours from 'date-fns/subHours';
import compareAsc from 'date-fns/compareAsc';
import { InfluxDB, Point, QueryApi, WriteApi } from '@influxdata/influxdb-client';
import { addMinutes, format, subMinutes } from 'date-fns';

const query = (): QueryApi => {
  console.log(config.influx.token);
  return new InfluxDB({ url: config.influx.url, token: config.influx.token }).getQueryApi(config.influx.org);
};

const write = (): WriteApi => {
  console.log(config.influx.token);
  return new InfluxDB({ url: config.influx.url, token: config.influx.token }).getWriteApi(
    config.influx.org,
    config.influx.bucket,
  );
};
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

async function main() {
  const now = new Date();
  const writeAPI = write();
  let earlier = subHours(now, 12);
  while (compareAsc(now, earlier)) {
    console.log('Generating for ', format(earlier, 'HH:mm:ss'));
    await gen(writeAPI, 0, 'sensor', earlier);
    await gen(writeAPI, 2, 'station', earlier);
    earlier = addMinutes(earlier, 1);
  }

  await writeAPI.close();
  console.log('done');
  process.exit(0);
}

async function gen(writeAPI, node_id, type, ts) {
  const points = [];
  const battery = getRandomInt(0, 100);
  const temperature = getRandomInt(20, 200);
  const rtc = Math.floor(ts.getTime() / 1000);

  points.push(
    new Point('battery')
      .tag('nodeid', '' + node_id)
      .tag('ntype', type)
      .floatField('value', battery)
      .timestamp(ts),
  );
  points.push(
    new Point('temperature')
      .tag('nodeid', '' + node_id)
      .tag('ntype', type)
      .floatField('value', temperature)
      .timestamp(ts),
  );
  points.push(
    new Point('rtc')
      .tag('nodeid', '' + node_id)
      .tag('ntype', type)
      .intField('value', rtc)
      .timestamp(ts),
  );
  writeAPI.writePoints(points);
}

main();
