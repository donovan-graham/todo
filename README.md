### Installation

Checkout repo:

```
git clone git@github.com:donovan-graham/todo.git
cd todo
```

1. Service dependencies:
   This repo uses the official [postgres](https://www.postgresql.org/) and [redis](https://redis.io/) docker images, which are run locally using [docker-copmose](https://docs.docker.com/compose/). There is also an optional [redis-insights](https://redis.io/insight/) container for convenience.

```
# in the repo root directory
docker-compose up
```

2. Server:
   The server is a [NodeJS](https://nodejs.org/en) based api, using [express](https://expressjs.com/).
   It has 3 component

   - A stateless api, authorized using JWT's (JSON Web Tokens)
   - Websockets, again authorized using JWT's (JSON Web Tokens)
   - Background workers who subscribe messages published to individual "todo lists" queues, and process the events in a predictable guaranteed order of operation.

   The service has been setup to allow evenutally moving to a HA multi-instance deployment and fronted by a reverse proxy, such as Nginx.

```
# in the repo root directory
cd server

# install dependencies
npm i

# note: please ensure docker-copmose services (postgres and redis) are running first
# run migrations (only needed once)
npm run migrate up

# run service
npm run dev
```

3. Client:
   The client is an [electron](https://www.electronjs.org/), [vite](https://vite.dev/guide/), [svelte](https://svelte.dev/docs/svelte/overview) [v5](https://svelte.dev/blog/svelte-5-is-alive) based workflow.
   It communicates with the server using both a stateless api and websockets.

```
# in the repo root directory
cd electron-app

# install dependencies
npm i

# install os specific build signing certificates (see electron-builder docs)
# TODO

# to run the development app
npm run dev

# to build an OS version
npm run build:mac
npm run build:win
npm run build:linux

# to open an OS version of the built app
open dist/mac-arm64/todo-app.app
```

### Testing

Server unit test are written in [jest](https://jestjs.io/).

```
npm run test
```

Client E2E test are writeen with [playwright](https://playwright.dev/) and [ElectronApplication](https://playwright.dev/docs/api/class-electronapplication) class.

```
# note: e2e test use built version of application.
npm run build
npm run test
```

# General Notes

This is the first time I've learnt and made use the following libraries, so I expect future imporvements and refinement on how to best implement.

- Electron
- Vite
- Svele
- zod
- bullmq
- pg-node-migrate

### Requirements

Node, NPM, Docker, Git

### Tested on

Mac Apple M1 Max, MacOS 14.6.1
Docker v27.4.0
Node 22.13.0

```

```
