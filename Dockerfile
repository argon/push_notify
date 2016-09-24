FROM node:6

MAINTAINER Andrew Naylor <argon@mkbot.net>
LABEL Description="push_notify"

ADD . /app
WORKDIR /app

VOLUME /app/credentials
RUN mkdir -p /var/dovecot

RUN npm install

ENV REDIS_URL=redis://redis:6379 CERT=credentials/cert.pem KEY=credentials/key.pem

ENTRYPOINT ["./entrypoint.sh"]

CMD ["node", "index.js"]
