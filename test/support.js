"use strict";

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const Promise = require("bluebird");

chai.use(chaiAsPromised);
chai.use(sinonChai);

global.expect = chai.expect;
global.sinon = sinon;

function APNConnection(sender) {
  this.write = sinon.stub();
  this.write.returns({});
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
  this.get       = sinon.stub();
  this.smembers  = sinon.stub();
}

RedisClient.prototype.sadd     = function () {};
RedisClient.prototype.set      = function () {};
RedisClient.prototype.get      = function () {};
RedisClient.prototype.smembers = function () {};

Promise.promisifyAll(RedisClient.prototype);

global.mock = {
  APNConnection,
  Controller,
  RedisClient,
}

