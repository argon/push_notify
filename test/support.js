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


function Controller() {
  this.register  = sinon.stub();
  this.notify    = sinon.stub();
  this.subscribe = sinon.stub();
}

function RedisClient() {
  this.sadd      = sinon.stub();
  this.srem      = sinon.stub();
  this.smembers  = sinon.stub();
  this.sismember = sinon.stub();
  this.set       = sinon.stub();
  this.get       = sinon.stub();
  this.del       = sinon.stub();
}

RedisClient.prototype.sadd      = function () {};
RedisClient.prototype.srem      = function () {};
RedisClient.prototype.smembers  = function () {};
RedisClient.prototype.sismember = function () {};
RedisClient.prototype.set       = function () {};
RedisClient.prototype.get       = function () {};
RedisClient.prototype.del       = function () {};

Promise.promisifyAll(RedisClient.prototype);

global.mock = {
  Controller,
  RedisClient,
}

