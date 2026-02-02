# Nginx Configuration

This directory contains Nginx reverse proxy configuration for Quailcomp.

## Files

- [quailcomp.conf](./quailcomp.conf) - Nginx server configuration with SSL, security headers, and reverse proxy settings

## Installation

Copy the configuration to Nginx sites-available:

```bash
sudo cp quailcomp.conf /etc/nginx/sites-available/quailcomp
```

Edit the file and replace `yourdomain.com` with your actual domain:

```bash
sudo vim /etc/nginx/sites-available/quailcomp
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/quailcomp /etc/nginx/sites-enabled/
```

Test configuration:

```bash
sudo nginx -t
```

Reload Nginx:

```bash
sudo systemctl reload nginx
```

## SSL Setup

The configuration expects SSL certificates from Let's Encrypt. Install certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain certificate:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Features

- HTTP to HTTPS redirect
- TLS 1.2 and 1.3 support
- Strong cipher configuration
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- OCSP stapling
- Gzip compression
- Request timeouts (60s)
- Health check endpoint (no logging)
- Metrics endpoint (restricted to internal networks)

## Customization

### Allow Different Origins

Edit the `allow` directives in the `/metrics` location:

```nginx
location /metrics {
    allow 10.0.0.0/8;
    allow YOUR_MONITORING_IP;
    deny all;
}
```

### Adjust Upload Size Limit

Change `client_max_body_size`:

```nginx
client_max_body_size 50M;  # Default: 10M
```

### Modify Timeouts

```nginx
proxy_connect_timeout 120s;  # Default: 60s
proxy_send_timeout 120s;
proxy_read_timeout 120s;
```

## Related Documentation

- [Production Deployment Guide](../../docs/how-to/deploy-production.md)
- [Deployment README](../README.md)
