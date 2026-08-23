#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/app/data}"

# --- Root mode (deprecated) ------------------------------------------------
# The container was explicitly started as root (--user 0:0). Remap the built-in
# nextjs user to the requested PUID/PGID, fix ownership of the data volume,
# then drop privileges before running the app. Kept as a compatibility path for
# volumes owned by a uid other than 1001.
if [ "$(id -u)" = "0" ]; then
  echo "warning: running as root is deprecated and will be removed in a future release." >&2
  echo "         Run the container as the owner of your data directory instead, e.g." >&2
  echo "         --user \$(id -u):\$(id -g) with a bind mount that user owns." >&2

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
  fi

  mkdir -p "$DATA_DIR"
  chown -R nextjs:nodejs "$DATA_DIR"

  exec gosu nextjs "$@"
fi

# --- Unprivileged mode (default) -------------------------------------------
# The image runs as the nextjs user unless overridden with --user. There are no
# privileges to drop, so run the command directly instead of failing in gosu.
if [ -n "$PUID" ] || [ -n "$PGID" ]; then
  echo "warning: PUID/PGID ignored - container already runs as uid=$(id -u) gid=$(id -g)." >&2
  echo "         Use --user to choose the uid, or --user 0:0 for the deprecated root mode." >&2
fi

# An unmapped UID has no passwd entry, so HOME may point somewhere unwritable.
if [ ! -w "$HOME" ]; then
  export HOME=/tmp
fi

if ! mkdir -p "$DATA_DIR" 2>/dev/null || [ ! -w "$DATA_DIR" ]; then
  echo "error: $DATA_DIR is not writable by uid=$(id -u) gid=$(id -g)." >&2
  echo "" >&2
  echo "  Bind mount:   chown -R $(id -u):$(id -g) /path/on/host" >&2
  echo "  Named volume: docker run --rm -u 0 -v <volume>:/data alpine \\" >&2
  echo "                  chown -R $(id -u):$(id -g) /data" >&2
  echo "" >&2
  echo "  Or run the container as the uid that already owns the data:" >&2
  echo "    --user <uid>:<gid>" >&2
  echo "  Or keep the deprecated root mode, which chowns it for you:" >&2
  echo "    --user 0:0 -e PUID=<uid> -e PGID=<gid>" >&2
  exit 1
fi

exec "$@"
