"use strict";

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");

chai.use(chaiAsPromised);
chai.use(sinonChai);

global.expect = chai.expect;

const sinon = require("sinon");
const Promise = require("bluebird");
function APNConnection(sender) {
  this.sender = sinon.stub();
  this.sender.returns({status: "200"});
}

APNConnection.prototype.pushNotification = function pushNotification(notification, recipients) {
  const builtNotification = {
    headers: notification.headers(),
    body:    notification.compile(),
  };

  if (!Array.isArray(recipients)) {
    recipients = [recipients];
  }

  return Promise.all( recipients.map(this.write.bind(this, builtNotification)) )
    .then( responses => {
    let sent = [];
    let failed = [];

    responses.forEach( response => {
      if (response.status) {
        failed.push(response);
      } else {
        sent.push(response);
      }
    });
    return {sent, failed};
  });
}

function Controller() {
  this.register  = sinon.stub();
  this.notify    = sinon.stub();
  this.subscribe = sinon.stub();
}

function RedisClient() {
  this.sadd      = sinon.stub();
  this.set       = sinon.stub();
  this.smembers  = sinon.stub();
}

RedisClient.prototype.sadd     = function () {};
RedisClient.prototype.set      = function () {};
RedisClient.prototype.smembers = function () {};

Promise.promisifyAll(RedisClient.prototype);

global.mock = {
  APNConnection,
  Controller,
  RedisClient,
}

