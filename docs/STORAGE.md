# Storage configuration

By default, ClawClass stores OpenClaw instance data in `./instances/` on the system disk. For larger deployments or when system disk space is limited, you can point to a separate mounted volume.

## Default setup (system disk)

```bash
# .env (or unset — uses default)
INSTANCES_HOST_DIR=./instances
```

Instance data stored at `./instances/` relative to the clawstack directory. Works for:
- Development
- Small-to-medium deployments (< 50GB)
- Single-server setups with sufficient disk

## Using a separate volume

If you have a mounted volume (e.g., `/mnt/storage`, `/data`, NFS mount), point to it:

```bash
# .env
INSTANCES_HOST_DIR=/mnt/storage/clawstack/instances
```

Or with Docker volumes:

```bash
# .env
INSTANCES_HOST_DIR=/var/lib/clawstack/instances

# Create a volume and mount it:
docker volume create clawstack-instances
# Then configure host mount in docker-compose.yml
```

## Migration: system disk → separate volume

If you start on system disk and later need to move to a separate volume:

1. **Stop ClawClass:**
   ```bash
   docker compose down
   ```

2. **Move instance data:**
   ```bash
   mkdir -p /mnt/storage/clawstack
   mv ./instances /mnt/storage/clawstack/
   ```

3. **Update .env:**
   ```bash
   INSTANCES_HOST_DIR=/mnt/storage/clawstack/instances
   ```

4. **Restart:**
   ```bash
   docker compose up -d
   ```

## Sizing

**Per instance:** ~500MB–2GB (depends on role and workload history)

**Quick estimate:**
- 5 instances: 5GB
- 20 instances: 20GB
- 100+ instances: 100GB+ (consider separate storage)

## Performance notes

- **System disk:** Faster, no network latency. Suitable for < 30 instances.
- **NFS/network mount:** More resilient for scaling, slight latency. Use for production swarms.
- **Local SSD volume:** Best for high I/O (many concurrent instances).
