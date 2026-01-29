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
- **Deployment**: Docker, Docker Compose

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

### Docker Deployment

1. **Clone the repository on your server**
   ```bash
   git clone <your-repo-url>
   cd homepage3
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

```bash
# Pull latest code
git pull

# Rebuild and restart container
docker compose down
docker compose build
docker compose up -d
```

## Troubleshooting

### View logs
```bash
docker compose logs -f homepage3
```

### Access container shell
```bash
docker compose exec homepage3 sh
```

### Check database
```bash
docker compose exec homepage3 sh
sqlite3 /app/data/homepage.db
.tables
.quit
```

### Reset database (WARNING: deletes all data)
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
