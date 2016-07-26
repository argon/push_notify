"use strict";

const apn = require("apn");
const redis = require("redis");

const redisClient = redis.createClient({url: process.env["REDIS_URL"]});
const apnConnection = new apn.Connection({});

const Controller = require("./lib/controller")({Notification: apn.Notification});
const Server = require("./lib/server");
const Socket = require("./lib/socket");

const controller = new Controller({ redis: redisClient, apn: apnConnection, prefix: process.env["REDIS_PREFIX"] });
const server = new Server({ controller });
const socket = new Socket("/tmp/dovecot.sock")
  .then( socket => {
    socket.on("data", server.receive.bind(server));
  });
