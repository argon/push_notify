"use strict";

function Controller(dependencies) {
  this.apn   = dependencies.apn;
  this.redis = dependencies.redis;
  this.notification = dependencies.notification;
}

Controller.prototype.register = function register(username, accountId, deviceToken, subtopic) {
  const prefix = this.redis.keyPrefix;
  
  this.redis.sadd(`${prefix}${username}:device`, deviceToken);
  this.redis.set(`${prefix}${username}:${deviceToken}:accountid`, accountId);
  this.redis.sadd(`${prefix}${deviceToken}:user`, username);
}

Controller.prototype.notify = function notify(username, mailbox) {
  const prefix = this.redis.keyPrefix;

  return this.redis.smembersAsync(`${prefix}${username}:device`).then( devices => {
    return this.apn.pushNotification(new this.notification(), devices)
  });
}

module.exports = Controller;
