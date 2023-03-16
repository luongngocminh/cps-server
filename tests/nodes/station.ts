import mqtt from 'mqtt';
import config from '../../src/config';
import { TOPICS, uint8arr2int } from '../../src/utils';
import { IBytesPacket, IPacketStatus, IPacketType } from '../../src/interfaces/IBytesPacket';
import crc32 from 'crc-32';

const NODEID = +process.argv[2];

const mqttClient = mqtt.connect(config.mqttURL, {
  clientId: `STATION_${NODEID}`,
  clean: false,
  username: 'admin',
  password: 'password',
});

const INTERVAL_MS = 20_000;

const nodeInfo = {
  nid: NODEID,
  type: 0xff, // 0xff is a station
  status: 0,
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
  const payload = Buffer.concat([Buffer.from([0]), tsbuf, Buffer.from([node.temperature])]);
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
  const payload = Buffer.concat([Buffer.from([0]), tsbuf, Buffer.from([node.temperature])]);
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
  const payload = Buffer.concat([Buffer.from([0]), tsbuf, Buffer.from([node.temperature])]);
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
  // ip is int 5486 +- 1
  // vshift is int 320 +- 1
  const ip = getRandomInt(5485, 5487);
  const vshift = getRandomInt(319, 321);

  // pack ip and vshift as 2 bytes
  const ipbuf = Buffer.alloc(2);
  ipbuf.writeInt16LE(ip, 0);
  const vshiftbuf = Buffer.alloc(2);
  vshiftbuf.writeInt16LE(vshift, 0);

  const packet = packMessage(node, type, Buffer.concat([vshiftbuf, ipbuf]));
  console.log(packet);
  mqttClient.publish(TOPICS.SVR_IN, packet, () => {
    console.log('published DATA');
  });
}

mqttClient.on('connect', function (connack) {
  console.log('MQTT Client connected: %o', connack);
  // subscribe to topic SVR_OUT
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
  if (packetInfo.type === IPacketType.CMD) {
    const isBroadcast = packetInfo.node.id === 0xff;
    if (!isBroadcast && packetInfo.node.id !== nodeInfo.nid) {
      return;
    }
    switch (packetInfo.data[0]) {
      case 0x00:
        console.log('CMD 0x00');
        const ts = uint8arr2int(packetInfo.data.slice(1));
        const diffNow = ts - Math.floor(new Date().getTime() / 1000);
        setTimeout(() => {
          sendDATA(nodeInfo);
        }, diffNow * 1000);
        break;
      case 0x01:
        console.log('CMD 0x01');
        break;
      case 0x02:
        console.log('CMD 0x02');
        break;
      case 0x03:
        console.log('CMD 0x03');
        sendDISCONN(nodeInfo);
        process.exit(0);
      default:
    }
  }
});
