// spawn sensor and station nodes
// station node have id 0, 1
// sensor nodes have id 3, 4, 5, 6
// station node 0 is parent of sensor node 3 and 4
// station node 1 is parent of sensor node 5 and 6
// a node can be spawn using the scripts in tests/nodes/sensor and tests/nodes/station
// for example: spawning a sensor node with id 3 and parent 0
// $ node tests/nodes/sensor.ts 3 0

// The ascii graph of the network
// 0
// |
// 3 - 4
// 1
// |
// 5 - 6

//
// below is the program to spawn these nodes

import { spawn } from 'child_process';
import { join } from 'path';

function main() {
  console.log('Spawning nodes...');
  const station0 = spawn('node_modules/.bin/ts-node', [join(__dirname, 'nodes/station.ts'), '0']);
  const station1 = spawn('node_modules/.bin/ts-node', [join(__dirname, 'nodes/station.ts'), '1']);
  const sensor3 = spawn('node_modules/.bin/ts-node', [join(__dirname, 'nodes/sensor.ts'), '3', '0']);
  const sensor4 = spawn('node_modules/.bin/ts-node', [join(__dirname, 'nodes/sensor.ts'), '4', '0']);
  const sensor5 = spawn('node_modules/.bin/ts-node', [join(__dirname, 'nodes/sensor.ts'), '5', '1']);
  const sensor6 = spawn('node_modules/.bin/ts-node', [join(__dirname, 'nodes/sensor.ts'), '6', '1']);

  station0.stdout.on('data', data => {
    console.log(`station0 stdout: ${data}`);
  });

  station0.stderr.on('data', data => {
    console.log(`station0 stderr: ${data}`);
  });

  station0.on('close', code => {
    console.log(`station0 child process exited with code ${code}`);
  });

  station1.stdout.on('data', data => {
    console.log(`station1 stdout: ${data}`);
  });

  station1.stderr.on('data', data => {
    console.log(`station1 stderr: ${data}`);
  });

  station1.on('close', code => {
    console.log(`station1 child process exited with code ${code}`);
  });

  sensor3.stdout.on('data', data => {
    console.log(`sensor3 stdout: ${data}`);
  });

  sensor3.stderr.on('data', data => {
    console.log(`sensor3 stderr: ${data}`);
  });

  sensor3.on('close', code => {
    console.log(`sensor3 child process exited with code ${code}`);
  });

  sensor4.stdout.on('data', data => {
    console.log(`sensor4 stdout: ${data}`);
  });

  sensor4.stderr.on('data', data => {
    console.log(`sensor4 stderr: ${data}`);
  });

  sensor4.on('close', code => {
    console.log(`sensor4 child process exited with code ${code}`);
  });

  sensor5.stdout.on('data', data => {
    console.log(`sensor5 stdout: ${data}`);
  });

  sensor5.stderr.on('data', data => {
    console.log(`sensor5 stderr: ${data}`);
  });

  sensor5.on('close', code => {
    console.log(`sensor5 child process exited with code ${code}`);
  });

  sensor6.stdout.on('data', data => {
    console.log(`sensor6 stdout: ${data}`);
  });

  sensor6.stderr.on('data', data => {
    console.log(`sensor6 stderr: ${data}`);
  });

  sensor6.on('close', code => {
    console.log(`sensor6 child process exited with code ${code}`);
  });
}

main();
