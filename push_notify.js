"use strict";

const net = require('net');
const fs  = require('fs');

const redis = require('redis');
const apn = require('apn');

const server = net.createServer( connection => {
  c.on('data', data => {
    const message = parseMessage(data)
    switch (message.type) {
      case 1:
        console.error("Create node, type 1 is deprecated");
        break;
      case 2:
        console.log("Registering client", message.d1, message.d2);
        register_client(message);
        break;
      case 3:
        console.log("Publishing notification", message.d1);
        publish(message);
        break;
      default:
        console.error("Error: unknown message type: ", message.type);
    }
  });
});

function parseMessage(data) {
  return {
    type: data.readUInt32LE(0),
    pid: data.readUInt32LE(4),

    d1: fromCString(data.slice(8,     135), 'utf8', 0),
    d2: fromCString(data.slice(136,   647), 'utf8', 0),
    d3: fromCString(data.slice(648,  1159), 'utf8', 0),
    d4: fromCString(data.slice(1160, 1671), 'utf8', 0),
  };
}

var redis_client = redis.createClient();
var connection = new apn.Connection({
  errorCallback: function(err, note) { console.log(err, note); },
  connectionTimeout: 300000
});
var feedback = new apn.Feedback({});
feedback.on('feedback', function(data) {
  for(var key in data) {
    unregister_device(data[key].device, data[key].time);
  }
});

function publish(message) {
  redis_client.smembers("pn:email:" + message.d1, function (err, replies) {
    if(replies === null) return;
    replies.forEach(function(value, i) {
      redis_client.get("pn:accountid:" + message.d1 + ":" + value, function(err, accountId) {
        if(accountId === null) return;
        // Send push notification
        var device = new apn.Device(value);
        var note = new apn.Notification();
        note.device = device;
        note.payload.aps = { "account-id": accountId };
        connection.sendNotification(note);
      });
    });
  });
}

function register_client(message) {
  redis_client.sadd("pn:email:" + message.d1, message.d3);
  redis_client.set("pn:accountid:" + message.d1 + ":" + message.d3, message.d2);
  redis_client.sadd("pn:device:" + message.d3, message.d1);

  var timestamp = Math.round((new Date()).getTime() / 1000);
  redis_client.set("pn:device:" + message.d3 + ":time", timestamp);
}

function unregister_device(deviceId, timestamp) {
  redis_client.get("pn:device:" + deviceId + ":time", function (err, reply) {
    if(reply === null) return;
    if(reply > timestamp) return;
    redis_client.smembers("pn:device:" + deviceId, function (err, replies) {
      replies.forEach(function(value, i) {
        redis_client.srem("pn:email:" + value, deviceId);
        redis_client.del("pn:accountid:" + value + ":" + deviceId);
      });
    });
  });
}

function fromCString(buffer, encoding, offset) {
  for(var i=offset; i<buffer.length; i++) {
    if(buffer[i] === 0) {
      return buffer.toString(encoding, offset, i);
    }
  }
  return null;
}

server.on('error', function (e) {
  if (e.code == 'EADDRINUSE') {
    let clientSocket = new net.Socket();
    clientSocket.on('error', function(e) { // handle error trying to talk to server
      if (e.code == 'ECONNREFUSED') {  // No other server listening
        fs.unlink('/var/dovecot/push_notify');
        server.listen('/var/dovecot/push_notify', function() { //'listening' listener
          console.log('server recovered');
        });
      }
    });
    clientSocket.connect({path: '/var/dovecot/push_notify'}, function() { 
      console.log('Server running, giving up...');
      process.exit();
    });
  }
});

server.listen('/var/dovecot/push_notify', function() {
  fs.chmod('/var/dovecot/push_notify', 0777);
});
