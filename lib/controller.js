"use strict";

const Promise = require("bluebird");

module.exports = function(dependencies) {
  
  const Notification = dependencies.Notification;

  function Controller(props) {
    this.apn    = props.apn;
    this.redis  = props.redis;
    this.prefix = props.prefix;
  }

  Controller.prototype.register = function register(username, accountId, deviceToken, subtopic) {
    const prefix = this.prefix;

    this.redis.sadd(`${prefix}${username}:device`, `${deviceToken}:${accountId}`);
  }

  Controller.prototype.notify = function notify(username, mailbox) {
    const prefix = this.prefix;
    const usernameKey = `${prefix}${username}:device`

    return this.redis.smembersAsync(usernameKey)
      .then( deviceAccounts => Promise.all(
        deviceAccounts.map( deviceAccount => {
          const [device, accountId] = deviceAccount.split(":", 2);
          const notification = new Notification({aps: {"account-id": accountId}});

          return Promise.resolve(this.apn.send(notification, device))
            .then( ( { failed } ) => failed)
            .each( failed => this.redis.sremAsync(usernameKey, `${failed.device}:${accountId}`))
        }))
    );
  }

  return Controller;
};
