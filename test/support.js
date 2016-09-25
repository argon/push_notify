"use strict";

const Promise = require("bluebird");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const sinonAsPromised = require("sinon-as-promised")(Promise);

chai.use(chaiAsPromised);
chai.use(sinonChai);

global.expect = chai.expect;
global.sinon = sinon;


function Controller() {
  this.register  = sinon.stub();
  this.notify    = sinon.stub();
  this.subscribe = sinon.stub();
}

const redisCommands = ["sadd", "srem", "smembers", "sismember", "del"];

function RedisClient() {
  for (let command of redisCommands[Symbol.iterator]()) {
    this[command] = sinon.stub();
  }
}

function Logger() {
  this.log = sinon.stub();
}

global.mock = {
  Controller,
  Logger,
  RedisClient,
}

