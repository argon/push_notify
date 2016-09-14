"use strict";

const apn = require("apn/mock");
const Controller = require("../lib/controller")({Notification: apn.Notification});

describe("Controller", function() {
  let fakes;
  let controller;

  beforeEach(function () {
    fakes = {
      apn:   new apn.Provider(),
      redis: new mock.RedisClient(),
      prefix: "test_pn_prefix:",
    }

    fakes.apn.client.write = sinon.stub().returns({});

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
        const expectedBody = JSON.stringify({"aps": { "account-id": accountId}});
        return sinon.match(function (value) {
          return value.body == expectedBody;
        }, expectedBody);
      };

      return notify.then( () => {
        expect(fakes.apn.client.write).to.have.been.calledWith(expectedNotification("account-id-1234"), "123456abcdef");
        expect(fakes.apn.client.write).to.have.been.calledWith(expectedNotification("account-id-4567"), "4567890fedcba");
      });
    });

    it("cleans up failed device tokens", function () {
      fakes.apn.client.write.withArgs(sinon.match.any, "123456abcdef").returns( { status: 410, device: "123456abcdef", response: { reason: "Unregistered", timestamp: 0 } });
      fakes.redis.srem.yields(null, 1);

      const notify = controller.notify("test@example.com", "INBOX");
      fakes.redis.smembers.yield(null, ["123456abcdef:account-id-1234", "4567890fedcba:account-id-4567"]);

      return notify.then( () => {
        expect(fakes.redis.srem).to.be.calledWith("test_pn_prefix:test@example.com:device", "123456abcdef:account-id-1234");
      });
    });
  });
});
