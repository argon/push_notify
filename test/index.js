"use strict";

function encodeMsgData(data) {
  let buffer = Buffer.alloc(1671, 0);

  buffer.writeUInt32LE(data.type, 0)
  buffer.writeUInt32LE(data.pid, 4);
  buffer.write(data.d1, 8, 128);
  buffer.write(data.d2, 136, 512);
  buffer.write(data.d3, 648, 512);
  buffer.write(data.d4, 1160, 512);

  return buffer;
}

const createSocket = require("../lib/socket");

const fs = require("fs");

describe("push_notify socket", function () {
  const testSocketPath = "/tmp/push_notify.socket";

  before(function () {
    try { fs.unlinkSync(testSocketPath) } catch (e) {};
  });

  afterEach(function () {
    try { fs.unlinkSync(testSocketPath) } catch (e) {};
  });

  it("creates a socket at the given path", function () {
    let server = createSocket(testSocketPath)

    return server.then( function () {
      let stats = fs.statSync(testSocketPath);
      expect(stats.isSocket()).to.be.true;
    }).finally( function() {
      server.value().close();
    });
  });

  it("sets the permissions of the socket to 777", function () {
    let server = createSocket(testSocketPath)

    return server.then( function () {
      let stats = fs.statSync(testSocketPath);
      expect(stats.mode & 0o777).to.equal(0o777);
    }).finally( function() {
      server.value().close();
    });
  });

  context("the socket path already exists", function () {
    beforeEach(function (done) {
      fs.open(testSocketPath, "w", 0o777, function (err, fd) {
        if (err) {
          throw err;
        }
        fs.close(fd, done);
      });
    });

    it("unlinks the file before opening", function () {
      let server = createSocket(testSocketPath)

      return server.then( function () {
        let stats = fs.statSync(testSocketPath);
        expect(stats.isSocket()).to.be.true;
      }).finally( function() {
        if (server.isFulfilled()) {
          server.value().close();
        }
      });
    });
  });

  context("a server is already running at the path", function () {
    it("is rejected", function () {
      let existingServer = createSocket(testSocketPath);
      return existingServer.then(() => {
        return expect(createSocket(testSocketPath))
          .to.eventually.be.rejectedWith(/Path in use/);
      })
    });
  });
});
