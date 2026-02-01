# Systemd Configuration Files

Configuration files for systemd service management on Linux servers.

## Files

- **[quailcomp.service](quailcomp.service)** - Systemd unit file for the Quailcomp server
- **[logrotate.conf](logrotate.conf)** - Log rotation configuration

## quailcomp.service

The systemd service unit file configures how the Quailcomp application runs as a system service.

**Key Features:**

- Runs as dedicated `quailcomp` user and group
- Auto-restart on failure with 10-second delay
- Resource limits (512MB memory, 200% CPU)
- Security hardening (NoNewPrivileges, PrivateTmp, ProtectSystem)
- Depends on PostgreSQL service
- Logs to systemd journal

**Installation:**

```bash
sudo cp quailcomp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable quailcomp
sudo systemctl start quailcomp
```

## logrotate.conf

Configuration for automatic log rotation using the system's logrotate service.

**Settings:**

- Rotates logs daily
- Keeps 14 days of history
- Compresses old logs with gzip
- Reloads service after rotation

**Installation:**

```bash
sudo cp logrotate.conf /etc/logrotate.d/quailcomp
```

## Related Documentation

- [Deployment Guide](../README.md) - Complete deployment instructions
- [Installation Script](../install.sh) - Automated installation
