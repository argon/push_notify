"use strict";

const Server = require("../lib/server");

describe("server", function() {
  let server;
  let fakes;

  beforeEach(function () {
    fakes = {
      controller: new mock.Controller(),
      logger: new mock.Logger(),
    };

    server = new Server(fakes);
  });

  context("registration message", function () {
    beforeEach(function () {
      let message = encodeMsgData({
        type: 2,
        pid: 0,

        d1: "test@example.com",      // Username
        d2: "account-id-1234",       // Account ID
        d3: "1234567890abcdef",      // Device Token
        d4: "io.github.argon.push",  // Subtopic
      });

      server.receive(message);
    });
    
    it("invokes `controller.register`", function () {
      expect(fakes.controller.register).to.be.calledWith("test@example.com", "account-id-1234", "1234567890abcdef", "io.github.argon.push");
    });

    it("logs the received message at `debug` level", function () {
      expect(fakes.logger.log).to.be.calledWithMatch("debug", "message received", { 
        type: 2,
        d1: "test@example.com", d2: "account-id-1234",
        d3: "1234567890abcdef", d4: "io.github.argon.push",
      });
    });
  });

  context("notify message", function () {
    beforeEach(function () {
      let message = encodeMsgData({
        type: 3,
        pid: 0,

        d1: "test@example.com",  // Username
        d2: "INBOX",             // Mailbox
      });

      server.receive(message);
    });

    it("invokes `controller.notify`", function() {
      expect(fakes.controller.notify).to.be.calledWith("test@example.com", "INBOX");
    });

    it("ignores notify messages with `raw mail user`", function() {
      let message = encodeMsgData({
        type: 3,
        pid: 0,

        d1: "raw mail user", // Dummy dovecot username
        d2: "raw",
      });

      fakes.controller.notify.reset();
      server.receive(message);

      expect(fakes.controller.notify).to.have.not.been.called;
    });

    it("logs the received message at `debug` level", function () {
      expect(fakes.logger.log).to.be.calledWithMatch("debug", "message received", { 
        type: 3,
        d1: "test@example.com", d2: "INBOX",
      });
    });
  });

  context("subscription message", function () {
    beforeEach(function () {
      let message = encodeMsgData({
        type: 4,
        pid: 0,

        d1: "test@example.com",      // Username
        d2: "account-id-1234",       // Account ID
        d3: "1234567890abcdef",      // Device Token
        d4: "INBOX",                 // Mailbox
      });

      server.receive(message);
    });

    it("invokes `controller.subscribe`", function() {
      expect(fakes.controller.subscribe).to.be.calledWith("test@example.com", "account-id-1234", "1234567890abcdef", "INBOX");
    });

    it("logs the received message at `debug` level", function () {
      expect(fakes.logger.log).to.be.calledWithMatch("debug", "message received", { 
        type: 4,
        d1: "test@example.com", d2: "account-id-1234",
        d3: "1234567890abcdef", d4: "INBOX",
      });
    });
  });
});

function encodeMsgData(data) {
  let buffer = Buffer.alloc(1671, 0);

  buffer.writeUInt32LE(data.type, 0)
  buffer.writeUInt32LE(data.pid, 4);
  buffer.write(data.d1 || "", 8, 128);
  buffer.write(data.d2 || "", 136, 512);
  buffer.write(data.d3 || "", 648, 512);
  buffer.write(data.d4 || "", 1160, 512);

  return buffer;
}

