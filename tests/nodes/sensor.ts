import mqtt from 'mqtt';
import config from '../../src/config';
import { TOPICS, uint8arr2int } from '../../src/utils';
import { IBytesPacket, IPacketStatus, IPacketType } from '../../src/interfaces/IBytesPacket';
import crc32 from 'crc-32';

const NODEID = +process.argv[2];

const mqttClient = mqtt.connect(config.mqttURL, {
  clientId: `SENSOR_${NODEID}`,
  clean: false,
  username: 'admin',
  password: 'password',
});

const INTERVAL_MS = 20_000;

const nodeInfo = {
  nid: NODEID,
  type: +process.argv[3], // process.argv[3] should be anything other than 0xff (station)
  status: 0,
  battery: 100,
  // rtc is time now in unix timestamp
  rtc: Math.floor(new Date().getTime() / 1000),
  temperature: 24,
};
function unpackMessage(bytes: Uint8Array): IBytesPacket {
  const checksum = bytes.slice(-4);
  const payload = bytes.slice(0, -4);
  const nodeMeta = payload[2];
  let nodeType = 0; // sensor
  let parent = null;
  if (nodeMeta === 0xff) {
    nodeType = 1;
  } else {
    parent = nodeMeta;
  }

  const version = payload[0];
  const node = {
    id: payload[1],
    type: nodeType,
    parent,
  };
  const type = payload[3] as IPacketType;
  const status = payload[4] as IPacketStatus;
  const ts = uint8arr2int(payload.slice(5, 9));
  const data = payload.slice(9);
  //
  return {
    id: checksum.toString(),
    version,
    node,
    type,
    status,
    ts,
    data,
  };
}

function packMessage(node, type, data: Buffer) {
  const version = 0;
  // a Sensor Node with ID 0
  const status = 0;
  const ts = Math.floor(new Date().getTime() / 1000);
  const header = Buffer.from([version, node.nid, node.type, type, status]);
  const tsbuf = Buffer.alloc(4);
  tsbuf.writeInt32LE(ts, 0);

  const bytes = Buffer.concat([header, tsbuf, data]);
  const crc = crc32.buf(bytes);
  const crcbuf = Buffer.alloc(4);
  crcbuf.writeInt32LE(crc, 0);
  const packet = Buffer.concat([bytes, crcbuf]);
  return packet;
}

function sendINFO(node) {
  const type = IPacketType.INFO; // INFO
  const tsbuf = Buffer.alloc(4);
  const ts = Math.floor(new Date().getTime() / 1000);
  tsbuf.writeInt32LE(ts, 0);
  const payload = Buffer.concat([Buffer.from([node.battery]), tsbuf, Buffer.from([node.temperature])]);
  const packet = packMessage(node, type, payload);
  mqttClient.publish(TOPICS.SVR_IN, packet, () => {
    console.log('published');
  });
}

function sendCONN(node) {
  const type = IPacketType.CONN; // CONN
  const tsbuf = Buffer.alloc(4);
  const ts = Math.floor(new Date().getTime() / 1000);
  tsbuf.writeInt32LE(ts, 0);
  const payload = Buffer.concat([Buffer.from([node.battery]), tsbuf, Buffer.from([node.temperature])]);
  const packet = packMessage(node, type, payload);
  mqttClient.publish(TOPICS.SVR_IN, packet, () => {
    console.log('published');
  });
}

function sendDISCONN(node) {
  const type = IPacketType.DISCONN; // DISCONN
  const tsbuf = Buffer.alloc(4);
  const ts = Math.floor(new Date().getTime() / 1000);
  tsbuf.writeInt32LE(ts, 0);
  const payload = Buffer.concat([Buffer.from([node.battery]), tsbuf, Buffer.from([node.temperature])]);
  const packet = packMessage(node, type, payload);
  mqttClient.publish(TOPICS.SVR_IN, packet, () => {
    console.log('published');
  });
}

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

function sendDATA(node) {
  const type = IPacketType.DATA; // DATA
  const tsbuf = Buffer.alloc(4);
  tsbuf.writeInt32LE(node.rtc, 0);
  // vna is -589
  // voff is random int value from -909 to -908
  // von is random int value from -909 to -908

  const vna = -589;
  const voff = getRandomInt(-909, -908);
  const von = getRandomInt(-909, -908);
  // pack absolute of vna, voff, von into 6 bytes, each value is 2 bytes
  const data = Buffer.alloc(6);
  data.writeInt16LE(von, 0);
  data.writeInt16LE(voff, 2);
  data.writeInt16LE(vna, 4);

  const packet = packMessage(node, type, data);
  mqttClient.publish(TOPICS.SVR_IN, packet, () => {
    console.log('published');
  });
}

mqttClient.on('connect', function (connack) {
  console.log('MQTT Client connected: %o', connack);

  mqttClient.subscribe(TOPICS.SVR_OUT, (err, granted) => {
    if (!err) {
      console.log('Subscribed to topic "svr/out"');
      // Send a CONN packet at initial connection
      sendCONN(nodeInfo);
      // Send INFO packet every 20 seconds
      setInterval(() => {
        sendINFO(nodeInfo);
      }, INTERVAL_MS);
    }
  });
});

mqttClient.on('message', (topic, message, packet) => {
  if (topic !== TOPICS.SVR_OUT) {
    return;
  }
  // unpack the message, If receive a CMD packet with type 0x00, send a DATA packet after received timestamp in CMD packet
  const bytes = new Uint8Array(message);
  const packetInfo = unpackMessage(bytes);
  console.log('packetInfo', packetInfo);

  if (packetInfo.type === IPacketType.CMD && packetInfo.data[0] === 0x00) {
    const ts = uint8arr2int(packetInfo.data.slice(1));
    const diffNow = ts - Math.floor(new Date().getTime() / 1000);
    setTimeout(() => {
      sendDATA(nodeInfo);
    }, diffNow * 1000);
  }
  // if receveive a CMD packet with type 0x03, send a DISCONN packet and exit
  if (packetInfo.type === IPacketType.CMD && packetInfo.data[0] === 0x03) {
    sendDISCONN(nodeInfo);
    process.exit(0);
  }
});
