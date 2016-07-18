"use strict";

function Controller(dependencies) {
  this.apn   = dependencies.apn;
  this.redis = dependencies.redis;
}

Controller.prototype.register = function register(username, accountId, deviceToken, subtopic) {
  const prefix = this.redis.keyPrefix;
  
  this.redis.sadd(`${prefix}${username}:device`, deviceToken);
  this.redis.set(`${prefix}${username}:${deviceToken}:accountid`, accountId);
  this.redis.sadd(`${prefix}${deviceToken}:user`, username);
}

module.exports = Controller;
