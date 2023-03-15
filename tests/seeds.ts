import config from '../src/config';
import subHours from 'date-fns/subHours';
import { InfluxDB, Point, QueryApi, WriteApi } from '@influxdata/influxdb-client';
import { addMinutes, format, subMinutes } from 'date-fns';
import * as fs from 'fs';
import { parse } from 'fast-csv';
import path from 'path';

const write = (): WriteApi => {
  console.log(config.influx.token);
  return new InfluxDB({ url: config.influx.url!, token: config.influx.token }).getWriteApi(
    config.influx.org!,
    config.influx.bucket!,
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

  // Generate random data for node health monitoring
  let earlier = subHours(now, 12);
  // while (compareAsc(now, earlier)) {
  //   console.log('Generating for ', format(earlier, 'HH:mm:ss'));
  //   await gen(writeAPI, 0, 'sensor', earlier);
  //   await gen(writeAPI, 2, 'station', earlier);
  //   earlier = addMinutes(earlier, 1);
  // }
  await genMockData(writeAPI);
  console.log('Done generating');
  await writeAPI.close();
  process.exit(0);
}

async function genMockData(writeAPI) {
  const seedFilePath = path.join(__dirname, 'seed.csv');
  console.log(seedFilePath);

  let now = new Date();
  return new Promise((resolve, reject) => {
    fs.createReadStream(seedFilePath)
      .pipe(parse())
      .on('error', error => reject(error))
      .on('data', row => {
        console.log(row);
        const ts = subMinutes(now, 10);
        now = subMinutes(now, 10);
        const [vp, ip, vshift, von, voff, vna] = row;
        const points: Point[] = [];
        points.push(
          new Point('v_off')
            .tag('nodeid', '' + 0)
            .tag('ntype', 'sensor')
            .intField('value', voff)
            .timestamp(ts),
        );
        points.push(
          new Point('v_on')
            .tag('nodeid', '' + 0)
            .tag('ntype', 'sensor')
            .intField('value', von)
            .timestamp(ts),
        );
        points.push(new Point('v_na').tag('nodeid', '0').tag('ntype', 'sensor').intField('value', vna).timestamp(ts));
        points.push(new Point('i_p').tag('nodeid', '2').tag('ntype', 'station').intField('value', ip).timestamp(ts));
        points.push(
          new Point('v_shift').tag('nodeid', '2').tag('ntype', 'station').intField('value', vshift).timestamp(ts),
        );

        writeAPI.writePoints(points);
      })
      .on('end', (rowCount: number) => {
        resolve(rowCount);
      });
  });
}

async function genNode(writeAPI, node_id, type, ts) {
  const points: Point[] = [];
  const battery = 98;
  const temperature = getRandomInt(24, 42);
  const rtc = Math.floor(ts.getTime() / 1000);

  if (type === 'sensor') {
    points.push(
      new Point('battery')
        .tag('nodeid', '' + node_id)
        .tag('ntype', type)
        .floatField('value', battery)
        .timestamp(ts),
    );
  }
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
