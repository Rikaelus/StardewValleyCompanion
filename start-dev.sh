#!/bin/bash
fuser -k 5173/tcp 2>/dev/null
npx vite --port 5173
