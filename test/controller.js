"use strict";

const Controller = require("../lib/controller");

describe("Controller", function() {
  let fakes;
  let controller;

  beforeEach(function () {
    fakes = {
      apn:   new mock.APNConnection(),
      redis: new mock.RedisClient(),
    }

    fakes.redis.keyPrefix = "test_pn_prefix:";

    controller = new Controller(fakes);
  });

  describe("register", function() {
    beforeEach(function () {
      controller.register("test@example.com", "1234abcd", "1234567890abcdef", "io.github.argon.push");
    });

    it("registers the device token in redis", function() {
      expect(fakes.redis.sadd).to.be.calledWith("test_pn_prefix:test@example.com:device", "1234567890abcdef");
    });

    it("registers the account id in redis", function() {
      expect(fakes.redis.set).to.be.calledWith("test_pn_prefix:test@example.com:1234567890abcdef:accountid", "1234abcd");
    });

    it("registers the username to the device token in redis", function() {
      expect(fakes.redis.sadd).to.be.calledWith("test_pn_prefix:1234567890abcdef:user", "test@example.com");
    });
  });
});
