var net = require('net');
var fs  = require('fs');

var redis = require('redis');
var apn = require('apn');

var server = net.createServer(function(c) { //'connection' listener
  c.on('end', function() { });
  c.on('data', function(data) {
  var msg_data = {};
    msg_data.msg = data.readUInt32LE(0);
    msg_data.pid = data.readUInt32LE(4);

    msg_data.d1 = fromCString(data.slice(8, 135), 'utf8', 0);
    msg_data.d2 = fromCString(data.slice(136, 647), 'utf8', 0);
    msg_data.d3 = fromCString(data.slice(648, 1159), 'utf8', 0);
    msg_data.d4 = fromCString(data.slice(1160, 1671), 'utf8', 0);

  if(msg_data.msg == 1) {
    console.error("Create node, msg 1 is deprecated");
  }
  else if(msg_data.msg == 2) {
    console.log("Registering client", msg_data.d1, msg_data.d2);
    register_client(msg_data);
  }
  else if(msg_data.msg == 3) {
    console.log("Publishing notification", msg_data.d1);
    publish(msg_data);
  }
  else {
    console.error("Error: unknown message type: ", msg_data.msg);
  }
  });
});

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

function publish(msg_data) {
  redis_client.smembers("pn:email:" + msg_data.d1, function (err, replies) {
    if(replies === null) return;
    replies.forEach(function(value, i) {
      redis_client.get("pn:accountid:" + msg_data.d1 + ":" + value, function(err, accountId) {
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

function register_client(msg_data) {
  redis_client.sadd("pn:email:" + msg_data.d1, msg_data.d3);
  redis_client.set("pn:accountid:" + msg_data.d1 + ":" + msg_data.d3, msg_data.d2);
  redis_client.sadd("pn:device:" + msg_data.d3, msg_data.d1);

  var timestamp = Math.round((new Date()).getTime() / 1000);
  redis_client.set("pn:device:" + msg_data.d3 + ":time", timestamp);
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
    var clientSocket = new net.Socket();
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
