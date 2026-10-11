#!/bin/sh
NODE22=/Users/sara/.local/share/mise/installs/node/22/bin
export PATH="$NODE22:$PATH"
exec "$NODE22/npm" run dev:all
