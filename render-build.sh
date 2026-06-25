#!/bin/bash
# Render Build Script

echo "Installing system dependencies..."
apt-get update
apt-get install -y ffmpeg

echo "Installing Node dependencies..."
npm install

echo "Building TypeScript..."
npm run build