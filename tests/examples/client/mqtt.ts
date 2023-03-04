import config from '../../../src/config';
import { TOPICS } from '../../../src/utils';
import crc32 from 'crc-32';
import mqtt from 'mqtt';
import { Buffer } from 'buffer';
const mqttClient = mqtt.connect(config.mqttURL, {
  clientId: 'Test',
  clean: false,
  username: 'admin',
  password: 'password',
});
mqttClient.on('connect', function (connack) {
  console.log('lmao');
  console.info('MQTT Client connected: %o', connack);
});

function main() {
  let batt = 88;
  setInterval(() => {
    testConnectNode(1, 0, 46, (batt -= 2));
  }, 5000);

  // testConnectNode(2, 1);
  // mqttClient.publish('svr/in');
}

function testConnectNode(id, _type, temp, battery) {
  // const checksum = .slice(-4);
  // const payload = bytes.slice(0, -4);

  const version = 0;
  // a Sensor Node with ID 0
  const node = {
    id,
    type: _type,
  };
  const type = 4; // CONN
  const status = 0;
  const ts = Math.floor(new Date().getTime() / 1000);
  const data = {
    temperature: temp,
    rtc: ts,
    battery: battery,
  };
  const header = Buffer.from([version, node.id, node.type, type, status]);
  const tsbuf = Buffer.alloc(4);
  tsbuf.writeInt32LE(ts, 0);
  const payload = Buffer.concat([Buffer.from([data.battery]), tsbuf, Buffer.from([data.temperature])]);

  const bytes = Buffer.concat([header, tsbuf, payload]);
  const crc = crc32.buf(bytes);
  const crcbuf = Buffer.alloc(4);
  crcbuf.writeInt32LE(crc, 0);
  const packet = Buffer.concat([bytes, crcbuf]);

  console.log(packet);
  console.log(packet.length);

  mqttClient.publish(TOPICS.SVR_IN, packet, () => {
    console.log('published');
  });
  // 00 00 00 04 00 50 23 ec 90 2d 90 61 af d1 cc 51
  // pack message
}
main();
