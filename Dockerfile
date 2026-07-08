FROM apify/actor-node-playwright-chrome:20

WORKDIR /home/myuser

COPY --chown=myuser package*.json ./

RUN npm --quiet set progress=false \
    && npm ci --include=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

COPY --chown=myuser . ./

CMD npm run start:local --silent
