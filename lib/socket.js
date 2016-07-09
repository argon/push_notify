"use strict";

const Promise = require("bluebird");
const net = Promise.promisifyAll(require("net"));
const fs = Promise.promisifyAll(require("fs"));

function Socket(path) {
  const server = net.createServer();

  return fs.statAsync(path)
    .then(cleanup.bind(this, path))
    .catch( err => {
      if (err.code == "ENOENT") {
        return;
      } else {
        throw err;
      }
    })
    .then(() => listen(server, path))
    .then(() => fs.chmodAsync(path, 0o777))
    .then(() => server);
}

function listen(server, path) {
  return new Promise( (resolve, reject) => {
    server.once("error", err => {
      reject(err);
    });
    server.listen(path, resolve);
  });
}

function cleanup(path) {
  return new Promise((resolve, reject) => {
    let client = new net.Socket();
    client.once("error", e => {
      if (e.code == "ENOTSOCK") {
        resolve(fs.unlinkAsync(path));
      } else {
        reject(e);
      }
    });
    client.once("connect", () => {
      client.end();
      reject(new Error("Path in use"));
    });
    client.connect({ path });
  });
}

module.exports = Socket;
