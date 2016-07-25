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
    it("registers the device token:accountid pair in redis", function() {
      controller.register("test@example.com", "1234abcd", "1234567890abcdef", "io.github.argon.push");
      expect(fakes.redis.sadd).to.be.calledWith("test_pn_prefix:test@example.com:device", "1234567890abcdef:1234abcd");
    });
  });

  describe("notify", function() {
    it("pushes to each registered device token", function () {
      const notify = controller.notify("test@example.com", "INBOX");
      fakes.redis.smembers.yield(null, ["123456abcdef:account-id-1234", "4567890fedcba:account-id-4567"]);

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

    it("cleans up failed device tokens", function () {

    });
  });
});
