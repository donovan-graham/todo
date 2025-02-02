### Installation

Checkout repo:

```
git clone git@github.com:donovan-graham/todo.git
cd todo
```

1. Service dependencies:
   This repo uses `postgres` and `redis`, which are run locally using docker. There is also a `redis-insights` container for convenience.

```
# in the repo root directory
docker-compose up
```

2. Server:
   The server is a NodeJS based api, using `express`.  
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

# note: please ensure docker services (postgres and redis) are running
# run migrations (only needed once)
npm run migrate up

# run service
npm run dev
```

3. Client:
   The client is an electron, vite, svelte based workflow. It communicates with the server using both a stateless api and websockets.

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

### Requirements

Node, NPM, Docker, Git

### Tested on

Mac Apple M1 Max, MacOS 14.6.1
Docker v27.4.0
Node 22.X

```

```
