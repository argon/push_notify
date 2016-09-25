"use strict";

const apn = require("apn");
const crypto = require("crypto");
const redis = require("ioredis");
const winston = require("winston");

const logger = winston;
logger.level = process.env["LOG_LEVEL"] || "warn";

const Controller = require("./lib/controller")({
  Notification: apn.Notification,
  md5: (data) => crypto.createHash('md5').update(data).digest("hex"),
});
const Server = require("./lib/server");
const Socket = require("./lib/socket");

Socket("/var/dovecot/push_notify")
  .then( socket => {
    const redisURL    = process.env["REDIS_URL"];
    const redisPrefix = process.env["REDIS_PREFIX"] || "pn:";
    const redisClient = new redis(redisURL);
    const apnProvider = new apn.Provider({
      cert: process.env["CERT"] || "cert.pem",
      key: process.env["KEY"] || key.pem,
      production: true
    });

    const controller = new Controller({
      apn: apnProvider,
      logger,
      prefix: redisPrefix,
      redis: redisClient,
    });
    const server     = new Server({ controller, logger });

    socket.on("connection", connection => {
      connection.on("data", server.receive.bind(server));
    });
  });
