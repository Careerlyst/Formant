FROM mcr.microsoft.com/playwright:v1.64.0-noble
WORKDIR /srv/showcase-renderer
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY security.mjs server.mjs ./
COPY assets/formant-symbol.svg ./assets/formant-symbol.svg
RUN chown -R pwuser:pwuser /srv/showcase-renderer
USER pwuser
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
