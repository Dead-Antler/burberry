#!/bin/sh
set -e

# If PUID or PGID are set, adjust the nextjs user/group to match
if [ -n "$PUID" ] || [ -n "$PGID" ]; then
  CURRENT_UID=$(id -u nextjs)
  CURRENT_GID=$(id -g nextjs)
  NEW_UID="${PUID:-$CURRENT_UID}"
  NEW_GID="${PGID:-$CURRENT_GID}"

  if [ "$NEW_GID" != "$CURRENT_GID" ]; then
    groupmod -g "$NEW_GID" nodejs
  fi
  if [ "$NEW_UID" != "$CURRENT_UID" ]; then
    usermod -u "$NEW_UID" nextjs
  fi

  chown nextjs:nodejs /app/data
fi

exec gosu nextjs "$@"
