"use strict";

const Server = require("../lib/server");

describe("server", function() {
  let server;
  let fakes;

  beforeEach(function () {
    fakes = {
      controller: new mock.Controller(),
    };

    server = new Server(fakes);
  });

  it("handles registration messages", function () {
    let message = encodeMsgData({
      type: 2,
      pid: 0,

      d1: "test@example.com",      // Username
      d2: "account-id-1234",       // Account ID
      d3: "1234567890abcdef",      // Device Token
      d4: "io.github.argon.push",  // Subtopic
    });

    server.receive(message);
    expect(fakes.controller.register).to.be.calledWith("test@example.com", "account-id-1234", "1234567890abcdef", "io.github.argon.push");
  });

  it("handles notify messages", function() {
    let message = encodeMsgData({
      type: 3,
      pid: 0,

      d1: "test@example.com",  // Username
      d2: "INBOX",             // Mailbox
    });

    server.receive(message);
    expect(fakes.controller.notify).to.be.calledWith("test@example.com", "INBOX");
  });

  it("handles subscription messages", function() {
    let message = encodeMsgData({
      type: 4,
      pid: 0,

      d1: "test@example.com",  // Username
      d2: "account-id-1234",   // Account ID
      d3: "1234567890abcdef",  // Device Token
      d4: "Archive",           // Mailbox
    });

    server.receive(message);
    expect(fakes.controller.subscribe).to.be.calledWith("test@example.com", "account-id-1234", "1234567890abcdef", "Archive");
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

