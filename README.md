# push notify

Apple Mail (iOS) Push support.

Handles registration of devices and sending of push notifications when mail is
received.

Works best with [dovecot-push_notify][dovecot-push_notify]

## Requirements

- Mail server
  - Dovecot, see [dovecot-push_notify][dovecot-push_notify]
- Mail server push certificates from macOS Server
- node-v6.3+
- redis

`push_notify` must be run on the same machine as the mail server as it
communicates via a UNIX socket.

## Caveat

This software requires credentials which can only be obtained through
macOS Server. As such it should only be run on Macintosh hardware. No other
configurations are supported or endorsed.

## Environment Variables

- `REDIS_URL`
- `REDIS_PREFIX` default: `pn:`


[dovecot-push_notify]:https://github.com/argon/dovecot-push_notify
