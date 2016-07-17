"use strict";

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");

chai.use(chaiAsPromised);
chai.use(sinonChai);

global.expect = chai.expect;

const sinon = require("sinon");
const Promise = require("bluebird");
function Controller() {
  this.register  = sinon.stub();
  this.notify    = sinon.stub();
  this.subscribe = sinon.stub();
}

global.mock = {
  Controller,
}

