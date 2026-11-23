# Local storage

Electron resolves the data root with `app.getPath("userData")`, normally `~/Library/Application Support/SearchAnvil`. Data lives under the macOS user's account.

| Location | Contents |
| --- | --- |
| `database/` | PostgreSQL cluster with data page checksums |
| `queue/` | Redis append-only queue data |
| `logs/` | Child service logs |
| `backups/` | A logical PostgreSQL dump before a changed set of migrations runs |
| Electron session directory | Chromium cookies and profile state for the local workspace |
| Temporary directory | Private socket, Redis launch configuration and analysis profiles |
| Native save dialog destination | User-selected CSV exports |

First launch initializes an isolated cluster in a sibling directory and renames it into place after initialization succeeds. The desktop app applies the checked-in SQL migrations using Prisma. On subsequent launches it compares a hash of the migration files with the last applied revision. Changed revisions prompt a logical backup of the existing database before migration. Failed startup keeps the database and backup. The migration log records the failed command.

To back up an internal build, quit SearchAnvil and copy the whole data root to protected storage. To restore, quit the app, preserve a separate copy of its current data root, and restore the offline copy to the same path. Use a build with the same PostgreSQL major version. A logical pre-migration dump is intended for a controlled restore into a separate database using the bundled `pg_restore`. Validate the recovered data with a separate profile before selecting it as the working copy. Upgrade and restore drills remain part of release verification.
