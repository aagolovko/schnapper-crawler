FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /home/pwuser

COPY --chown=pwuser:pwuser package*.json ./

RUN npm --quiet set progress=false \
    && npm ci --include=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

COPY --chown=pwuser:pwuser . ./

USER pwuser

CMD npm run start:local --silent
