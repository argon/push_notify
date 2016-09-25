"use strict";

const Promise = require("bluebird");

module.exports = function(dependencies) {
  
  const Notification = dependencies.Notification;
  const md5          = dependencies.md5

  function Controller(props) {
    this.apn    = props.apn;
    this.logger = props.logger;
    this.redis  = props.redis;
    this.prefix = props.prefix;
  }

  Controller.prototype.register = function register(username, accountId, deviceToken, subtopic) {
    const prefix = this.prefix;

    this.logger.log("info", "Controller.register", { username });

    this.redis.sadd(`${prefix}${username}:device`, `${deviceToken}:${accountId}`);
    this.redis.del(`${prefix}${username}:${deviceToken}:${accountId}:subscriptions`);
  }

  Controller.prototype.notify = function notify(username, mailbox) {
    const prefix = this.prefix;
    const usernameKey = `${prefix}${username}`
    const mailboxHash = md5(mailbox);

    this.logger.log("info", "Controller.notify", { username, mailbox });

    return this.redis.smembers(`${usernameKey}:device`)
      .then( deviceAccounts => Promise.all(
        deviceAccounts.map( deviceAccount => {
          return this.redis.sismember(`${usernameKey}:${deviceAccount}:subscriptions`, mailboxHash)
            .then( shouldSend => {
              if (!shouldSend) {
                return null;
              }
              const [device, accountId] = deviceAccount.split(":", 2);
              const notification = new Notification({aps: {"account-id": accountId, m: [mailboxHash]}});

              this.logger.log("info", "Controller.notify.send", { username, device, notification: notification.compile()});
          
              return Promise.resolve(this.apn.send(notification, device))
                .then( ( { failed } ) => failed)
                .filter( ( result ) => {
                  if (result.response) {
                    let reason = result.response.reason;
                    if (reason == "Unregistered") {
                      this.logger.log("warn", "Controller.notify.send.unregistered", { username, device });
                      return true;
                    }
                  }
                  return false
                })
                .each( failed => Promise.all([
                  this.redis.srem(`${usernameKey}:device`, `${failed.device}:${accountId}`),
                  this.redis.del(`${usernameKey}:${deviceAccount}:subscriptions`),
                ])
              );
            });
        })
      )
    );
  }

  Controller.prototype.subscribe = function subscribe(username, accountId, device, mailbox) {
    const prefix = this.prefix;

    this.logger.log("info", "Controller.subscribe", { username, mailbox })

    this.redis.sadd(`${prefix}${username}:${device}:${accountId}:subscriptions`, md5(mailbox));
  }

  return Controller;
};
