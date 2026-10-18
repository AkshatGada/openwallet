FROM python:3.12-bookworm AS python
FROM node:22-bookworm AS node
FROM rust:1.94.0-bookworm
COPY --from=python /usr/local/ /usr/local/
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
RUN rustup component add clippy rustfmt
COPY linux-wheels /tmp/linux-wheels
RUN python3 -m venv /opt/ows-venv && /opt/ows-venv/bin/pip install --no-index --find-links=/tmp/linux-wheels maturin pytest
ENV PATH="/opt/ows-venv/bin:$PATH"
WORKDIR /work
