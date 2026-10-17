# Production ownership

This project owns the static generator application. Shared Caddy and server networks are managed from `E:\work\server149` (`/opt/server149` on the VPS).

On this VPS use `/opt/server149/scripts/generator-compose.sh` for production Compose operations. The generator uses `server149_qp_edge`; it must not join the chush database network or change shared Caddy configuration during application deployment.

State is stored in the user's browser IndexedDB; there is no server database for this app.
