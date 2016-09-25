"use strict";

const Promise = require("bluebird");

module.exports = function(dependencies) {
  
  const Notification = dependencies.Notification;
  const md5          = dependencies.md5

  function Controller(props) {
    this.apn    = props.apn;
    this.redis  = props.redis;
    this.prefix = props.prefix;
  }

  Controller.prototype.register = function register(username, accountId, deviceToken, subtopic) {
    const prefix = this.prefix;

    this.redis.sadd(`${prefix}${username}:device`, `${deviceToken}:${accountId}`);
    this.redis.del(`${prefix}${username}:${deviceToken}:${accountId}:subscriptions`);
  }

  Controller.prototype.notify = function notify(username, mailbox) {
    const prefix = this.prefix;
    const usernameKey = `${prefix}${username}`
    const mailboxHash = md5(mailbox);

    return this.redis.smembersAsync(`${usernameKey}:device`)
      .then( deviceAccounts => Promise.all(
        deviceAccounts.map( deviceAccount => {
          return this.redis.sismemberAsync(`${usernameKey}:${deviceAccount}:subscriptions`, mailboxHash)
            .then( shouldSend => {
              if (!shouldSend) {
                return null;
              }
              const [device, accountId] = deviceAccount.split(":", 2);
              const notification = new Notification({aps: {"account-id": accountId, m: [mailboxHash]}});

              return Promise.resolve(this.apn.send(notification, device))
                .then( ( { failed } ) => failed)
                .filter( ( { response } ) => response.reason == "Unregistered" )
                .each( failed => Promise.all([
                  this.redis.sremAsync(`${usernameKey}:device`, `${failed.device}:${accountId}`),
                  this.redis.delAsync(`${usernameKey}:${deviceAccount}:subscriptions`),
                ])
              );
            });
        })
      )
    );
  }

  Controller.prototype.subscribe = function subscribe(username, accountId, deviceToken, mailbox) {
    const prefix = this.prefix;

    this.redis.sadd(`${prefix}${username}:${deviceToken}:${accountId}:subscriptions`, md5(mailbox));
  }

  return Controller;
};
