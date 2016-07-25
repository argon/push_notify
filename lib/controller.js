"use strict";

module.exports = function(dependencies) {
  
  const Notification = dependencies.Notification;

  function Controller(props) {
    this.apn    = props.apn;
    this.redis  = props.redis;
    this.prefix = props.prefix;
  }

  Controller.prototype.register = function register(username, accountId, deviceToken, subtopic) {
    const prefix = this.prefix;

    this.redis.sadd(`${prefix}${username}:device`, deviceToken);
    this.redis.set(`${prefix}${username}:${deviceToken}:accountid`, accountId);
    this.redis.sadd(`${prefix}${deviceToken}:user`, username);
  }

  Controller.prototype.notify = function notify(username, mailbox) {
    const prefix = this.prefix;

    return this.redis.smembersAsync(`${prefix}${username}:device`)
      .then( devices => Promise.all(
        devices.map( device => this.redis.getAsync(`${prefix}${username}:${device}:accountid`)
          .then( accountId => new Notification({aps: {"account-id": accountId}}) )
          .then( notification => this.apn.pushNotification(notification, device) )
          .catch( () => "not found" )
        ))
    );
  }

  return Controller;
};
