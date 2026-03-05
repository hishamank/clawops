#!/usr/bin/env bash
# Start Next.js dev server with custom port from WEB_PORT env variable
PORT=${WEB_PORT:-3333} next dev --port ${WEB_PORT:-3333}
