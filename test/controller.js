"use strict";

const apn = require("apn/mock");

describe("Controller", function() {
  let fakes;
  let controller;

  beforeEach(function () {
    fakes = {
      apn:   new apn.Provider(),
      logger: new mock.Logger(),
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

    it("logs the username at info level", function () {
      expect(fakes.logger.log).to.be.calledWith("info", "Controller.register", { username: "test@example.com" });
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
        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:123456abcdef:account-id-1234:subscriptions", "md5-value").resolves(1);
        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:123456abcdef:account-id-4567:subscriptions", "md5-value").resolves(0);
        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:4567890fedcba:account-id-4567:subscriptions", "md5-value").resolves(1);

        fakes.redis.smembers.resolves([
          "123456abcdef:account-id-1234", 
          "123456abcdef:account-id-4567",
          "4567890fedcba:account-id-4567",
        ]);

        return controller.notify("test@example.com", "INBOX");
      });

      it("pushes to each registered and subscribed device token", function () {
        expect(fakes.apn.client.write).to.have.been.calledWith(expectedNotification("account-id-1234"), "123456abcdef");
        expect(fakes.apn.client.write).to.have.been.calledWith(expectedNotification("account-id-4567"), "4567890fedcba");
      });

      it("does not push to non-subscribed device token", function () {
        expect(fakes.apn.client.write).to.have.not.been.calledWith(expectedNotification("account-id-4567"), "123456abcdef");
      });

      it("logs the username at info level", function () {
        expect(fakes.logger.log).to.be.calledWithMatch("info", "Controller.notify", { username: "test@example.com", mailbox: "INBOX" });
      });

      it("logs each device:account at debug level", function () {
        expect(fakes.logger.log).to.be.calledWith("debug", "Controller.notify.device", { username: "test@example.com", device: "123456abcdef:account-id-1234" });
        expect(fakes.logger.log).to.be.calledWith("debug", "Controller.notify.device", { username: "test@example.com", device: "123456abcdef:account-id-4567" });
        expect(fakes.logger.log).to.be.calledWith("debug", "Controller.notify.device", { username: "test@example.com", device: "4567890fedcba:account-id-4567" });
      });

      it("logs shouldSend information for each device at debug level", function () {
        expect(fakes.logger.log).to.be.calledWith("debug", "Controller.notify.shouldSend", { username: "test@example.com", device: "123456abcdef:account-id-1234", shouldSend: 1});
        expect(fakes.logger.log).to.be.calledWith("debug", "Controller.notify.shouldSend", { username: "test@example.com", device: "123456abcdef:account-id-4567", shouldSend: 0});
        expect(fakes.logger.log).to.be.calledWith("debug", "Controller.notify.shouldSend", { username: "test@example.com", device: "4567890fedcba:account-id-4567", shouldSend: 1});
      });

      it("logs sent notifications at info level", function () {
        expect(fakes.logger.log).to.be.calledWith("info", "Controller.notify.send", sinon.match({ username: "test@example.com", device: "123456abcdef", notification: sinon.match.string }));
        expect(fakes.logger.log).to.be.calledWith("info", "Controller.notify.send", sinon.match({ username: "test@example.com", device: "4567890fedcba", notification: sinon.match.string }));
      });
    });

    context("token rejected", function () {
      let apnWriteResolve;
      beforeEach(function () {
        fakes.apn.client.write.withArgs(sinon.match.any, "123456abcdef")
          .returns(new Promise( resolve => { apnWriteResolve = resolve; }));

        fakes.redis.srem.resolves(1);
        fakes.redis.del.resolves(1);

        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:123456abcdef:account-id-1234:subscriptions", "md5-value").resolves(1);
        fakes.redis.sismember.withArgs("test_pn_prefix:test@example.com:4567890fedcba:account-id-4567:subscriptions", "md5-value").resolves(1);
        
        fakes.redis.smembers.resolves(["123456abcdef:account-id-1234", "4567890fedcba:account-id-4567"]);

        notify = controller.notify("test@example.com", "INBOX");
        
      });

      context("`Unregistered` token", function () {
        beforeEach(function () {
          apnWriteResolve({ status: "410", device: "123456abcdef", response: { reason: "Unregistered", timestamp: 0 } });

          return notify;
        });
        
      it("cleans up failed device token from user account", function () {
          expect(fakes.redis.srem).to.be.calledOnce;
          expect(fakes.redis.srem).to.be.calledWith("test_pn_prefix:test@example.com:device", "123456abcdef:account-id-1234");
        });

        it("deletes device subscriptions set", function (){
          expect(fakes.redis.del).to.be.calledOnce;
          expect(fakes.redis.del).to.be.calledWith("test_pn_prefix:test@example.com:123456abcdef:account-id-1234:subscriptions");
        });

        it("logs the device token at warn level", function () {
          expect(fakes.logger.log).to.be.calledWith("warn", "Controller.notify.send.unregistered", { username: "test@example.com", device: "123456abcdef"});
        });
      });

      context("other reason", function () {
        beforeEach(function () {
          apnWriteResolve({ status: "503", device: "123456abcdef", response: { reason: "ServiceUnavailable" } });
          return notify;
        });

        it("does not cleanup the token from the user account", function () {
          expect(fakes.redis.srem).to.not.be.called;
        });

        it("does not delete the device subscriptions set", function (){
          expect(fakes.redis.del).to.not.be.called;
        });

        it("logs the device token and reason at warn level", function () {
          expect(fakes.logger.log).to.be.calledWith("warn", "Controller.notify.send.failure", { username: "test@example.com", device: "123456abcdef", reason: "ServiceUnavailable"});
        });
      });

      context("send error", function () {
        beforeEach(function () {
          apnWriteResolve({ status: "503", device: "123456abcdef", error: new Error("failed") });
          return notify;
        });

        it("does not cleanup the token from the user account", function () {
          expect(fakes.redis.srem).to.not.be.called;
        });

        it("does not delete the device subscriptions set", function (){
          expect(fakes.redis.del).to.not.be.called;
        });

        it("logs the device token and error at error level", function () {
          expect(fakes.logger.log).to.be.calledWith("error", "Controller.notify.send.error", { username: "test@example.com", device: "123456abcdef", error: sinon.match.any });
        });
      });
    });
  });

  describe("subscribe", function () {
    beforeEach(function () {
      fakes.md5.withArgs("INBOX").returns("md5-value");

      controller.subscribe("test@example.com", "1234abcd", "1234567890abcdef", "INBOX");
    });
    
    it("adds the MD5'd mailbox name to the username:token:accountid set", function () {
      expect(fakes.redis.sadd).to.be.calledWith("test_pn_prefix:test@example.com:1234567890abcdef:1234abcd:subscriptions", "md5-value");
    });

    it("logs the username, device and mailbox at info level", function () {
      expect(fakes.logger.log).to.be.calledWith("info", "Controller.subscribe", { username: "test@example.com", mailbox: "INBOX" });
    });
  });
});
