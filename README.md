# Homepage3 - Void Dashboard

A premium, high-performance home server dashboard that transforms complex home lab environments into a visually stunning, organized command center.

## Features

- **Void Aesthetic**: Glassmorphic UI with 24px backdrop blur and breathing gradients
- **Automated Branding**: Auto-fetch app icons and generate dynamic 4-color gradients
- **Real-Time Monitoring**: Live status updates via Server-Sent Events (SSE)
- **Dual-Path UX**: Family-friendly unauthenticated view + protected admin control panel
- **Local-First**: 100% functional on local network, no cloud dependencies
- **Observation-Only**: Monitor server health without control actions
- **Multi-Admin Support**: Superuser and delegated admin accounts

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, CSS Modules, Framer Motion
- **Backend**: Node.js 22, Better-SQLite3, Jose (JWT)
- **Deployment**: Docker, Docker Compose, Dockge, Unraid

## Deployment Quick Links

- [Unraid + Dockge Deployment](#deployment-on-unraid-with-dockge) - Recommended for Unraid users
- [Standard Docker Compose](#standard-docker-compose-deployment) - For other Docker hosts
- [Updating on Dockge](#updating-on-unraid-with-dockge)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Node.js 22+ (for local development)
- Docker & Docker Compose (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd homepage3
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your `JWT_SECRET`:
   ```bash
   # Generate a secure secret
   openssl rand -base64 32
   ```

4. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

### Deployment on Unraid with Dockge

**Dockge** is a Docker Compose management UI that makes container management simple on Unraid.

1. **Install Dockge on Unraid** (if not already installed)
   - Install from Community Applications
   - Default setup works fine

2. **Clone repository on your Unraid server**
   ```bash
   # SSH into your Unraid server
   cd /mnt/user/appdata/docker-apps
   git clone https://github.com/yourusername/home3.git
   cd home3
   ```

3. **Set up environment variables**
   ```bash
   # Generate a secure JWT secret
   openssl rand -base64 32

   # Create .env file
   nano .env
   ```

   Add the following to `.env`:
   ```env
   JWT_SECRET=your-generated-secret-here
   NODE_ENV=production
   DATA_PATH=/app/data
   PORT=3000
   ```

4. **Build the Docker image**
   ```bash
   docker build --no-cache -t homepage3:latest -f Dockerfile .
   ```

5. **Start via Dockge**
   - Open Dockge UI in your browser
   - Click "Compose" and find your `home3` stack
   - Click "Start" or "Up"
   - The stack name must be lowercase (e.g., `home3` not `Home3`)

6. **Check logs**
   ```bash
   docker logs home3 -f
   ```

   You should see:
   - ✅ Found migrations directory at: /app/lib/migrations
   - ✨ Database is up to date
   - Ready in XXXms

7. **Access the dashboard**
   ```
   http://your-unraid-ip:3005
   ```
   (Port 3005 is mapped from internal port 3000 in docker-compose.yml)

**Important Notes for Dockge/Unraid:**
- Stack names must be lowercase (`home3`, not `Home3`)
- Data persists in Docker volume `homepage3_homepage3-data`
- Use Dockge UI to stop/start, NOT `docker-compose` commands
- To rebuild after updates: Run `docker build` manually, then use Dockge to restart
- The database is stored in `/mnt/user/appdata/docker-apps/home3/data` on the host

### Standard Docker Compose Deployment

1. **Clone the repository on your server**
   ```bash
   git clone https://github.com/yourusername/home3.git
   cd home3
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   nano .env  # Edit and set JWT_SECRET
   ```

3. **Build and start the container**
   ```bash
   docker compose up -d
   ```

4. **Check container status**
   ```bash
   docker compose ps
   docker compose logs -f homepage3
   ```

5. **Access the dashboard**
   ```
   http://your-server-ip:3000
   ```

### First Run Setup

On first launch, you'll be automatically redirected to the onboarding screen to:
1. Create your superuser account (required)
2. Optionally set server name and branding
3. Optionally load discovery template with common categories

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ Yes | - | Secret key for JWT signing and credential encryption |
| `NODE_ENV` | No | `production` | Node environment (development/production) |
| `DATA_PATH` | No | `./data` | Path to persistent data directory |
| `PORT` | No | `3000` | Server port |
| `LOG_LEVEL` | No | `INFO` | Logging level (DEBUG/INFO/WARN/ERROR) |

## Project Structure

```
homepage3/
├── app/                    # Next.js pages (React Server Components)
│   ├── admin/              # Admin panel routes
│   ├── onboarding/         # First-run setup
│   └── page.tsx            # Home grid
├── api/                    # Next.js API Route Handlers
│   ├── auth/               # Authentication endpoints
│   ├── cards/              # CRUD for app cards
│   ├── categories/         # CRUD for categories
│   └── stream/             # SSE endpoints
├── components/             # Reusable React components
│   ├── cards/              # App card variants
│   ├── admin/              # Admin UI components
│   └── layout/             # Layout components
├── lib/                    # Server utilities
│   ├── db.ts               # Database client
│   ├── auth.ts             # JWT utilities
│   ├── crypto.ts           # Encryption utilities
│   └── migrations/         # Database migrations
├── drivers/                # Integration drivers
├── services/               # Business logic
├── data/                   # Persistent data (gitignored)
│   ├── homepage.db         # SQLite database
│   ├── cache/              # Auto-fetched icons
│   └── uploads/            # User-uploaded assets
├── Dockerfile              # Docker image definition
└── docker-compose.yml      # Docker Compose configuration
```

## Backup & Recovery

### Backup
The entire application state is stored in the `/data` directory:

```bash
# Stop the container
docker compose down

# Backup the data volume
docker run --rm -v homepage3_homepage3-data:/data -v $(pwd):/backup alpine tar czf /backup/homepage3-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restart the container
docker compose up -d
```

### Recovery
```bash
# Stop the container
docker compose down

# Restore from backup
docker run --rm -v homepage3_homepage3-data:/data -v $(pwd):/backup alpine tar xzf /backup/homepage3-backup-YYYYMMDD.tar.gz -C /data

# Restart the container
docker compose up -d
```

## Updating

### Updating on Unraid with Dockge

```bash
# SSH into your Unraid server
cd /mnt/user/appdata/docker-apps/home3

# Pull latest code
git pull

# Rebuild the Docker image
docker build --no-cache -t homepage3:latest -f Dockerfile .

# Use Dockge UI to stop and start the stack
# Or via command line:
# (Note: Only use Dockge UI, avoid docker-compose commands)
```

**Via Dockge UI:**
1. Open Dockge
2. Find your `home3` stack
3. Click "Down" to stop
4. Click "Up" to start with new image

### Updating with Docker Compose

```bash
# Pull latest code
git pull

# Rebuild and restart container
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Troubleshooting

### View logs (Dockge/Unraid)
```bash
# Real-time logs
docker logs home3 -f

# Last 50 lines
docker logs home3 --tail 50
```

### View logs (Docker Compose)
```bash
docker compose logs -f homepage3
```

### Access container shell
```bash
# Dockge/Unraid
docker exec -it home3 sh

# Docker Compose
docker compose exec homepage3 sh
```

### Check database
```bash
# Inside container shell
sqlite3 /app/data/homepage.db
.tables
SELECT * FROM users;
.quit
```

### Common Issues

**Login redirects back to login page**
- Check browser cookies in DevTools → Application → Cookies
- Cookie `homepage3_session` should be present
- If missing, check Docker logs for authentication errors
- Ensure you're accessing via HTTP (not HTTPS) if `secure: false` in code

**Migrations not running**
- Check logs for "Found migrations directory" message
- Verify `/app/lib/migrations` exists in container
- Rebuild with `--no-cache` flag if migrations were added after initial build

**Container won't start**
- Check logs: `docker logs home3`
- Verify port 3005 (or your configured port) is not in use
- Ensure data volume has correct permissions

**Dockge shows "Stack name can only contain [a-z][0-9]_-"**
- Rename your folder to lowercase (e.g., `home3` not `Home3`)
- Rename the Git repository if needed
- Re-clone with lowercase name

### Reset database (WARNING: deletes all data)

**Dockge/Unraid:**
```bash
# Stop container via Dockge UI, then:
docker volume rm homepage3_homepage3-data
# Start container via Dockge UI
```

**Docker Compose:**
```bash
docker compose down
docker volume rm homepage3_homepage3-data
docker compose up -d
```

## Development

### Run migrations manually
```bash
npm run db:migrate
```

### Build for production
```bash
npm run build
npm start
```

### Type checking
```bash
npx tsc --noEmit
```

## Contributing

This is a personal project. Feel free to fork and adapt to your needs.

## License

MIT

## Documentation

- [Full Project Plan](./FullProjectPlan.md) - Comprehensive product specification
- [Technical Implementation Plan](./TechnicalImplementationPlan.md) - Architecture and implementation details

## Support

For issues and feature requests, please open an issue on GitHub.
