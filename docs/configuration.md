# Configuration

NAI Factory reads its settings from environment variables. With Docker, pass them with `-e`
(`docker run -e NAI_FACTORY_ACCESS_TOKEN=change-me ...`) or under `environment:` in
`docker-compose.yml`.

| Variable                                  | Default                    | Description                                    |
| ----------------------------------------- | -------------------------- | ---------------------------------------------- |
| `HOST`                                    | `127.0.0.1`                | Listen address (`0.0.0.0` in the Docker image) |
| `PORT`                                    | `3000`                     | Listen port                                    |
| `NAI_FACTORY_DATA_DIR`                    | `./data`                   | Data folder (database and files)               |
| `DATABASE_URL`                            | `<data dir>/database.db`   | SQLite file                                    |
| `DATABASE_CACHE_SIZE`                     | `10000`                    | SQLite `cache_size` pragma                     |
| `NAI_FACTORY_ACCESS_TOKEN`                | —                          | Require this token for every API call          |
| `NAI_FACTORY_ALLOWED_HOSTS`               | —                          | Comma-separated extra host names               |
| `NAI_FACTORY_EXPORT_DIR`                  | —                          | Enables server export below this folder        |
| `NAI_FACTORY_MAX_UPLOAD_MB`               | `512`                      | Largest request body                           |
| `NAI_FACTORY_ARCHIVE_MAX_UNCOMPRESSED_MB` | `4096`                     | Largest uncompressed `.naif` archive           |
| `NAI_FACTORY_DATA_ENCRYPTION_ENABLED`     | `false`                    | Encrypt new files with AES-256-GCM             |
| `NAI_FACTORY_DATA_ENCRYPTION_KEY`         | —                          | 32-byte key as base64 or 64 hex characters     |
| `NAI_FACTORY_NOVELAI_MODE`                | `live`                     | Initial NovelAI mode (`live`, `mock`, `fail`)  |
| `NAI_FACTORY_SSE_HEARTBEAT_MS`            | `15000`                    | Realtime event heartbeat                       |
| `LOG_LEVEL`, `LOG_PRETTY`, `LOG_COLORIZE` | `info`, dev only, dev only | Logging                                        |

## Encryption

Encryption covers newly written files and the stored API key; existing plaintext files stay
readable.

```sh
NAI_FACTORY_DATA_ENCRYPTION_ENABLED=true
NAI_FACTORY_DATA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

See [Data folder](data-folder.md) for where files are stored and [Security](security.md) for
access control.
