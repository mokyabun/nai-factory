# Security

NAI Factory has no user accounts. By default:

- **Local only**: the server listens on `127.0.0.1` (the Docker examples publish the port on
  `127.0.0.1:3000`).
- **Write-only API key**: the key is verified with NovelAI and stored; the API only returns a masked hint such as `****abcd`.
- **Browser protection**: cross-site requests (Origin and `Sec-Fetch-Site` checks) and unknown
  host names are refused, which blocks DNS rebinding. IPs, `localhost`, and names in
  `NAI_FACTORY_ALLOWED_HOSTS` are accepted.
- **Files by id**: files are served as `/api/assets/:id`, never by path.

## Sharing on your LAN

- Publish the port on all interfaces (`-p 3000:3000`, or `HOST=0.0.0.0` without Docker).
- Anyone who can reach the server can then generate images with your key (they cannot read it), so set `NAI_FACTORY_ACCESS_TOKEN`. The browser asks for the token once and keeps it in an HttpOnly cookie.

## Server export

- Copying images to a folder on the server machine is off unless `NAI_FACTORY_EXPORT_DIR` is set.
- Exports go to a sub-folder of that directory, named in the export dialog.

## Data encryption

- Files and the stored API key can be encrypted at rest. See
  [Configuration](configuration.md#encryption).
