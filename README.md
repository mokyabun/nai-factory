# NAI Factory


## About

NAI Factory is a local web app for organizing NovelAI image-generation projects.
It helps you manage projects, scenes, prompt variables, references, generation
queues, and saved outputs from one small workspace.

![Project screen](docs/images/project-screen.png)
![Settings screen](docs/images/settings-screen.png)
![Generated image screen](docs/images/generated-image-screen.png)

## Features

- Project, group, scene, and variation management
- Prompt and negative prompt editing
- Global and per-scene prompt variables
- NovelAI image generation queue
- Playground mode for quick generations
- Character reference and vibe transfer support
- Thumbnail generation and local image storage
- SD Studio import support
- Local SQLite database with automatic migrations
- App settings for NovelAI API key, image format, thumbnails, and debug logs

## Installation

### Requirements

- [Bun](https://bun.sh/)
- A NovelAI account with image generation access

### Local Development

Install dependencies:

```sh
bun install
```

Start the API server and web client:

```sh
bun dev
```

Open the app:

```text
http://localhost:5173
```

The API server runs at:

```text
http://localhost:3000
```

Local data is stored in:

```text
server/data
```

### Docker

Build and start the app:

```sh
docker compose up --build
```

Open the Docker app:

```text
http://localhost:3000
```

The Docker API runs under:

```text
http://localhost:3000/api
```

Generated images and the SQLite database are stored in the Docker volume
`nai_factory_data`.

To stop the app:

```sh
docker compose down
```

To remove saved Docker data as well:

```sh
docker compose down -v
```

## Usage

1. Start the app.
2. Open the web client.
3. Go to Settings.
4. Sign in to NovelAI in your browser and copy your NovelAI API key from your
   NovelAI account settings.
5. Paste the key into `NovelAI API Key`.
6. The app saves settings automatically.
7. Create a project.
8. Add scenes, prompts, variables, character references, or vibe transfers.
9. Add items to the queue or use Playground for quick tests.
10. Generated images are saved locally.

Keep your NovelAI API key private. Do not commit local databases, generated
images, or `.env` files.
