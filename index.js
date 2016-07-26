"use strict";

const apn = require("apn");
const redis = require("redis");
const Promise = require("bluebird");

Promise.promisifyAll(redis.RedisClient.prototype);

const redisURL    = process.env["REDIS_URL"];
const redisPrefix = process.env["REDIS_PREFIX"];
const redisClient = redis.createClient({url: redisURL});
const apnConnection = new apn.Connection({});

const Controller = require("./lib/controller")({Notification: apn.Notification});
const Server = require("./lib/server");
const Socket = require("./lib/socket");

const controller = new Controller({ redis: redisClient, apn: apnConnection, prefix: redisPrefix });
const server     = new Server({ controller });
const socket     = new Socket("/var/dovecot/push_notify")
  .then( socket => {
    socket.on("data", server.receive.bind(server));
  });
