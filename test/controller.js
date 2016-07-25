"use strict";

const apn = require("apn");
const Controller = require("../lib/controller")({Notification: apn.Notification});

describe("Controller", function() {
  let fakes;
  let controller;

  beforeEach(function () {
    fakes = {
      apn:   new mock.APNConnection(),
      redis: new mock.RedisClient(),
      prefix: "test_pn_prefix:",
    }

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

  describe("notify", function() {
    it("pushes to each registered device token", function () {
      const notify = controller.notify("test@example.com", "INBOX");
      fakes.redis.get.withArgs("test_pn_prefix:test@example.com:123456abcdef:accountid").yields(null, "account-id-1234");
      fakes.redis.get.withArgs("test_pn_prefix:test@example.com:4567890fedcba:accountid").yields(null, "account-id-4567");
      fakes.redis.smembers.yield(null, ["123456abcdef", "4567890fedcba"]);

      const expectedNotification = function (accountId) {
        return sinon.match(function (value) {
          return value.body == JSON.stringify({"aps": { "account-id": accountId}});
        }, `notification containing ${accountId}`);
      };

      return notify.then( () => {
        expect(fakes.apn.write).to.have.been.calledWith(expectedNotification("account-id-1234"), "123456abcdef");
        expect(fakes.apn.write).to.have.been.calledWith(expectedNotification("account-id-4567"), "4567890fedcba");
      });
    });
  });
});
