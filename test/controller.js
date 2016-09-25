"use strict";

const apn = require("apn/mock");

describe("Controller", function() {
  let fakes;
  let controller;

  beforeEach(function () {
    fakes = {
      apn:   new apn.Provider(),
      md5: sinon.stub(),
      redis: new mock.RedisClient(),
      prefix: "test_pn_prefix:",
    }

    fakes.md5.withArgs("INBOX").returns("md5-value");
    fakes.apn.client.write = sinon.stub().returns({});

    const Controller = require("../lib/controller")({
      Notification: apn.Notification,
      md5: fakes.md5
     });

    controller = new Controller(fakes);
  });

  describe("register", function() {
    beforeEach(function () {
      controller.register("test@example.com", "1234abcd", "1234567890abcdef", "io.github.argon.push");
    });

    it("registers the device token:accountid pair in redis", function() {
      expect(fakes.redis.sadd).to.be.calledWith("test_pn_prefix:test@example.com:device", "1234567890abcdef:1234abcd");
    });

    it("deletes the username:token:accountid subscriptions set in redis", function () {
      expect(fakes.redis.del).to.be.calledWith("test_pn_prefix:test@example.com:1234567890abcdef:1234abcd:subscriptions");
    });
  });

  describe("notify", function() {
    let notify;
    describe("push behaviour", function () {

      const expectedNotification = function (accountId) {
        const expectedBody = JSON.stringify({"aps": { "account-id": accountId, m: [ "md5-value" ]}});
        return sinon.match(function (value) {
          return value.body == expectedBody;
        }, expectedBody);
      };

      beforeEach(function () {
        notify = controller.notify("test@example.com", "INBOX");
        
        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:123456abcdef:account-id-1234:subscriptions", "md5-value").yields(null, 1);
        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:123456abcdef:account-id-4567:subscriptions", "md5-value").yields(null, 0);
        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:4567890fedcba:account-id-4567:subscriptions", "md5-value").yields(null, 1);

        fakes.redis.smembers.yield(null, [
          "123456abcdef:account-id-1234", 
          "123456abcdef:account-id-4567",
          "4567890fedcba:account-id-4567",
        ]);
      });

      it("pushes to each registered and subscribed device token", function () {
        return notify.then( () => {
          expect(fakes.apn.client.write).to.have.been.calledWith(expectedNotification("account-id-1234"), "123456abcdef");
          expect(fakes.apn.client.write).to.have.been.calledWith(expectedNotification("account-id-4567"), "4567890fedcba");
        });
      });

      it("does not push to non-subscribed device token", function () {
        return notify.then( () => {
          expect(fakes.apn.client.write).to.have.not.been.calledWith(expectedNotification("account-id-4567"), "123456abcdef");
        });
      });
    });

    context("token rejected", function () {
      let apnWriteResolve;
      beforeEach(function () {
        fakes.apn.client.write.withArgs(sinon.match.any, "123456abcdef")
          .returns(new Promise( resolve => { apnWriteResolve = resolve; }));

        fakes.redis.srem.yields(null, 1);
        fakes.redis.del.yields(null, 1);

        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:123456abcdef:account-id-1234:subscriptions", "md5-value").yields(null, 1);
        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:4567890fedcba:account-id-4567:subscriptions", "md5-value").yields(null, 1);

        notify = controller.notify("test@example.com", "INBOX");
        
        fakes.redis.smembers.yield(null, ["123456abcdef:account-id-1234", "4567890fedcba:account-id-4567"]);
      });

      context("`Unregistered` token", function () {
        beforeEach(function () {
          apnWriteResolve({ status: "410", device: "123456abcdef", response: { reason: "Unregistered", timestamp: 0 } });
        });
        
        it("cleans up failed device token from user account", function () {
          return notify.then( () => {
            expect(fakes.redis.srem).to.be.calledOnce;
            expect(fakes.redis.srem).to.be.calledWith("test_pn_prefix:test@example.com:device", "123456abcdef:account-id-1234");
          });
        });

        it("deletes device subscriptions set", function (){
          return notify.then( () => {
            expect(fakes.redis.del).to.be.calledOnce;
            expect(fakes.redis.del).to.be.calledWith("test_pn_prefix:test@example.com:123456abcdef:account-id-1234:subscriptions");
          });
        });
      });

      context("other reason", function () {
        beforeEach(function () {
          apnWriteResolve({ status: "503", device: "123456abcdef", response: { reason: "ServiceUnavailable" } });
        });

        it("does not cleanup the token from the user account", function () {
          return notify.then( () => {
            expect(fakes.redis.srem).to.not.be.called;
          });
        });

        it("does not delete the device subscriptions set", function (){
          return notify.then( () => {
            expect(fakes.redis.del).to.not.be.called;
          });
        });
      });
    });
  });

  describe("subscribe", function () {
    it("adds the MD5'd mailbox name to the username:token:accountid set", function () {
      fakes.md5.withArgs("INBOX").returns("md5-value");

      controller.subscribe("test@example.com", "1234abcd", "1234567890abcdef", "INBOX");
      expect(fakes.redis.sadd).to.be.calledWith("test_pn_prefix:test@example.com:1234567890abcdef:1234abcd:subscriptions", "md5-value");
    });
  });
});
