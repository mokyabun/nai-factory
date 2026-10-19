# Data folder

`NAI_FACTORY_DATA_DIR` (default `./data`, `/app/server/data` in the Docker image) holds everything
NAI Factory stores.

```text
data/
  database.db   SQLite database (WAL mode: also database.db-wal / -shm)
  images/       generated images, by project and scene
  thumbs/       thumbnails
  playground/   playground images and thumbnails
  refs/         vibe transfer and character reference images
  backups/      database copies taken before each migration
  trash/        unknown files, kept for 30 days
```

- **Backup:** stop the server and copy the whole folder. Paths are stored relative to it, so it
  can be moved or mounted anywhere.
- **Upgrades:** the database is copied to `backups/` before new migrations run (images are not).
  Delete old copies when you no longer need them.
- **Trash:** at startup and once a day, files the database does not know about move to
  `trash/<UTC time>/` with their original paths. Move them back to restore.
- Data folders from versions before 0.3.0 are not supported.

Keep the data folder and `.env` files out of public repositories.
