"use strict";

function Server(dependencies) {
  this.controller = dependencies.controller;
}

function readCString(buf) {
  for(let i = 0; i < buf.length; i++) {
    if(buf[i] === 0) {
      return buf.toString("utf8", 0, i);
    }
  }
}

function decode(data) {
  return {
    type: data.readUInt32LE(0),
    pid: data.readUInt32LE(4),

    d1: readCString(data.slice(8,     135), 'utf8', 0),
    d2: readCString(data.slice(136,   647), 'utf8', 0),
    d3: readCString(data.slice(648,  1159), 'utf8', 0),
    d4: readCString(data.slice(1160, 1671), 'utf8', 0),
  };
}

Server.prototype.receive = function receive(data) {
  const message = decode(data);

  switch(message.type) {
    case 2:
      this.controller.register(message.d1, message.d2, message.d3, message.d4);
      break;

    case 3:
      this.controller.notify(message.d1, message.d2);
      break;

    case 4:
      this.controller.subscribe(message.d1, message.d2, message.d3, message.d4);
      break;
  }
}

module.exports = Server;

