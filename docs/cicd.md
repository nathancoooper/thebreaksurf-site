# CI/CD Pipeline — GitHub Actions

Automated build and deploy on push to `main`.

---

## How It Works

1. You `git push` to `main`
2. GitHub Actions SSHs into the server
3. Runs `docker compose build` (with build cache)
4. Restarts containers with `docker compose up -d`
5. Verifies the site is healthy

---

## Setup

### 1. Create GitHub Secrets

Go to your repo on GitHub → Settings → Secrets and variables → Actions → New repository secret.

| Secret Name | Value |
|-------------|-------|
| `SERVER_HOST` | `100.97.28.200` (or Tailscale IP) |
| `SERVER_USER` | `cooper2n` |
| `SERVER_SSH_KEY` | Contents of your private SSH key (see below) |

**To generate a deploy key** (recommended over using your personal key):

On your Mac:
```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github-deploy -N ""
cat ~/.ssh/github-deploy.pub
```

Add the public key to the server's `~/.ssh/authorized_keys`:
```bash
# On server
echo "<contents of github-deploy.pub>" >> ~/.ssh/authorized_keys
```

Add the **private key** (`~/.ssh/github-deploy`, the file without `.pub`) as the `SERVER_SSH_KEY` secret in GitHub.

### 2. Workflow File

Already created at `.github/workflows/deploy.yml`. No changes needed.

---

## How Deploy Works

1. **Push to main** triggers the workflow
2. SSH into the server
3. `git pull` the latest code
4. `docker compose build` rebuilds the `web` image (uses BuildKit cache, ~2-3 min)
5. `docker compose up -d --force-recreate --no-deps web` restarts only the web container
6. Polls `localhost:3000` up to 30 times waiting for HTTP 200
7. If healthy, deploy succeeds. If not, prints logs and fails.

Nginx and cloudflared stay running — only the web container restarts on deploy.

---

## Manual Deploy

If you need to deploy without pushing (e.g. after a config change):

```bash
# SSH into server
ssh cooper2n@<server-ip>

cd /home/cooper2n/Documents/thebreaksite

# Rebuild and restart everything
docker compose build && docker compose up -d

# Or just the web container
docker compose build web && docker compose up -d --force-recreate --no-deps web
```

---

## Build Cache

Docker BuildKit caches layers between builds. The first build takes ~5-10 min; subsequent builds take ~2-3 min since `npm ci` and `apt install` layers are cached.

If builds slow down, clear the cache:
```bash
docker builder prune -f
```

---

## Troubleshooting

**Deploy fails with SSH error:**
- Check the deploy key is correct in GitHub secrets
- Test manually: `ssh -i ~/.ssh/github-deploy cooper2n@<server-ip>`

**Deploy succeeds but site is down:**
- Check logs: `docker compose logs web`
- Check the entrypoint: `docker exec thebreaksite-web-1 cat /app/docker-entrypoint.sh`
- Verify env file: `docker compose config`

**Build takes too long:**
- Check if BuildKit cache exists: `docker builder ls`
- Ensure `npm ci` is using the lockfile (not `npm install`)

**Site returns 502:**
- Nginx can't reach the web container
- Check: `docker compose ps` — is `web` actually running?
- Check: `docker compose logs nginx`

---

## Adding Calera Site

When you're ready to add calderasite to CI/CD, create a separate workflow:

```yaml
# .github/workflows/deploy-calera.yml
name: Deploy Calera Site
on:
  push:
    branches: [main]
    paths:
      - 'calera/**'
```

Or run both sites on the same server with separate docker-compose files.</think><tool_call>
<function=bash>
<parameter=command>mkdir -p /home/cooper2n/Documents/thebreaksite/.github/workflows