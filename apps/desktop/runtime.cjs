const { spawn } = require("node:child_process");
const { createHash, randomBytes } = require("node:crypto");
const { createWriteStream } = require("node:fs");
const {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const host = "127.0.0.1";
const secret = () => randomBytes(32).toString("hex");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolve(server.address().port));
  });
}

async function vacantPort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function startProcess(command, args, { cwd, env, log, name, ipc }) {
  const stream = createWriteStream(log, { flags: "a", mode: 0o600 });
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ipc ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });
  stream.once("error", () => child.kill());
  const exited = new Promise((resolve) => {
    child.once("error", (error) => {
      stream.end();
      resolve(error);
    });
    child.once("close", (code, signal) => {
      stream.end();
      resolve(code === 0 ? undefined : new Error(`${name} exited (${signal ?? code})`));
    });
  });
  return { child, exited };
}

async function waitUntilReady(url, headers, child, name) {
  const ready = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(500) }).catch(
        () => undefined,
      );
      if (response?.ok) return;
      await delay(250);
    }
    throw new Error(`${name} did not become ready`);
  };
  await Promise.race([
    ready(),
    child.exited.then((error) => {
      throw error ?? new Error(`${name} exited during startup`);
    }),
  ]);
}

function gateway({ capability, apiPort, webPort, getOrigin }) {
  return http.createServer((request, response) => {
    const origin = getOrigin();
    const expectedHost = new URL(origin).host;
    if (
      request.headers.host !== expectedHost ||
      request.headers["x-searchanvil-window"] !== capability ||
      (request.headers.origin !== undefined && request.headers.origin !== origin) ||
      !request.url?.startsWith("/") ||
      request.url.startsWith("//")
    ) {
      response.writeHead(403).end();
      return;
    }

    const api = request.url.startsWith("/desktop-api/api/v1/");
    const port = api ? apiPort : webPort;
    const headers = { ...request.headers, host: `${host}:${port}` };
    delete headers["x-searchanvil-window"];
    if (api) headers["x-searchanvil-desktop-capability"] = capability;

    const upstream = http.request(
      {
        hostname: host,
        port,
        method: request.method,
        path: api ? request.url.slice("/desktop-api".length) : request.url,
        headers,
      },
      (result) => {
        const csp =
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; " +
          "form-action 'self'; connect-src 'self'";
        response.writeHead(result.statusCode, {
          ...result.headers,
          "content-security-policy": csp,
          "x-content-type-options": "nosniff",
        });
        result.pipe(response);
      },
    );
    upstream.setTimeout(30_000, () => upstream.destroy());
    upstream.on("error", () => {
      if (response.headersSent) response.destroy();
      else response.writeHead(502).end("SearchAnvil local runtime is unavailable.");
    });
    response.on("close", () => upstream.destroy());
    request.pipe(upstream);
  });
}

async function startRuntime(resources, data, onFailure) {
  const native = path.join(resources, "native", "bin");
  const logs = path.join(data, "logs");
  const database = path.join(data, "database");
  const queue = path.join(data, "queue");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "searchanvil-"));
  const processes = [];
  let stopping = false;
  let server;
  let stopPromise;

  function stop() {
    stopPromise ??= (async () => {
      stopping = true;
      server?.close();
      server?.closeAllConnections();
      for (const process of processes.reverse()) {
        process.child.kill(process.name === "PostgreSQL" ? "SIGINT" : "SIGTERM");
        await Promise.race([process.exited, delay(4000, undefined, { ref: false })]);
        if (process.child.exitCode === null && process.child.signalCode === null) {
          process.child.kill("SIGKILL");
          await process.exited;
        }
      }
      await rm(temporary, { recursive: true, force: true });
    })();
    return stopPromise;
  }

  try {
    await Promise.all(
      [logs, queue].map((directory) => mkdir(directory, { recursive: true, mode: 0o700 })),
    );

    // Pass only the values needed by the bundled processes. In particular,
    // do not inherit developer database, queue, proxy, or Node configuration.
    const baseEnv = {
      HOME: process.env.HOME,
      PATH: "/usr/bin:/bin",
      LC_ALL: "C.UTF-8",
      TMPDIR: temporary,
    };
    const log = (name) => path.join(logs, name + ".log");
    async function run(name, command, args, env = baseEnv) {
      const process = startProcess(command, args, { env, log: log(name), name });
      const error = await process.exited;
      if (error) throw new Error(`${name} failed. See ${log(name)}`, { cause: error });
    }

    const pgCommand = (name) => path.join(native, name);
    const exists = await access(database).then(
      () => true,
      (error) => {
        if (error.code !== "ENOENT") throw error;
        return false;
      },
    );
    if (!exists) {
      const initial = await mkdtemp(path.join(data, "database-init-"));
      await run("database-init", pgCommand("initdb"), [
        "-D",
        initial,
        "-U",
        "searchanvil",
        "--auth-local=trust",
        "--auth-host=scram-sha-256",
        "--data-checksums",
      ]);
      await rename(initial, database);
    }

    const capability = secret();
    const redisPassword = secret();
    const [redisPort, apiPort, webPort] = await Promise.all([
      vacantPort(),
      vacantPort(),
      vacantPort(),
    ]);
    if (new Set([redisPort, apiPort, webPort]).size !== 3) {
      throw new Error("Could not allocate distinct local runtime ports.");
    }

    let origin;
    server = gateway({ capability, apiPort, webPort, getOrigin: () => origin });
    origin = `http://${host}:${await listen(server)}`;
    const browser = path.join(resources, "chromium");
    const browserExecutable = (await readFile(path.join(browser, "executable"), "utf8")).trim();
    if (!browserExecutable || path.basename(browserExecutable) !== browserExecutable) {
      throw new Error("Invalid bundled Chromium executable name.");
    }
    const env = {
      ...baseEnv,
      NODE_ENV: "production",
      DATABASE_URL: `postgresql://searchanvil@localhost:5432/postgres?host=${encodeURIComponent(temporary)}`,
      REDIS_URL: `redis://:${redisPassword}@${host}:${redisPort}`,
      WEB_URL: origin,
      API_PORT: String(apiPort),
      SEARCHANVIL_DESKTOP_CAPABILITY: capability,
      PORT: String(webPort),
      HOSTNAME: host,
      WORKER_CONCURRENCY: "1",
      PERFORMANCE_WORKER_CONCURRENCY: "1",
      CHROMIUM_EXECUTABLE_PATH: path.join(
        browser,
        "Chromium.app",
        "Contents",
        "MacOS",
        browserExecutable,
      ),
    };

    function supervise(name, command, args, processEnv = env, ipc = false) {
      const process = startProcess(command, args, { env: processEnv, log: log(name), name, ipc });
      processes.push({ ...process, name });
      return process;
    }

    const postgres = supervise(
      "PostgreSQL",
      pgCommand("postgres"),
      [
        "-D",
        database,
        "-k",
        temporary,
        "-c",
        "listen_addresses=",
        "-c",
        "unix_socket_permissions=0700",
        "-c",
        "shared_buffers=32MB",
      ],
      baseEnv,
    );
    const socket = path.join(temporary, ".s.PGSQL.5432");
    let databaseReady = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if ((await access(socket).catch(() => false)) !== false) {
        databaseReady = true;
        break;
      }
      if (postgres.child.exitCode !== null) throw new Error("PostgreSQL could not start.");
      await delay(100);
    }

    if (!databaseReady) throw new Error("PostgreSQL did not become ready.");

    const redisConfig = path.join(temporary, "redis.conf");
    await writeFile(
      redisConfig,
      `bind ${host}\nport ${redisPort}\nrequirepass ${redisPassword}\nappendonly yes\nsave ""\n`,
      { mode: 0o600 },
    );
    supervise("Redis", pgCommand("redis-server"), [redisConfig, "--dir", queue], baseEnv);

    const node = path.join(resources, "node", "bin", "node");
    const schema = path.join(resources, "database", "prisma");
    const migrations = path.join(schema, "migrations");
    const migrationHash = createHash("sha256");
    for (const migration of (await readdir(migrations, { withFileTypes: true })).sort(
      (left, right) => left.name.localeCompare(right.name),
    )) {
      if (migration.isDirectory()) {
        migrationHash.update(migration.name);
        migrationHash.update(
          await readFile(path.join(migrations, migration.name, "migration.sql")),
        );
      }
    }
    const expectedMigration = migrationHash.digest("hex");
    const marker = path.join(data, "migration-revision");
    const appliedMigration = await readFile(marker, "utf8").catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return undefined;
    });
    if (expectedMigration !== appliedMigration && exists) {
      const backups = path.join(data, "backups");
      await mkdir(backups, { recursive: true, mode: 0o700 });
      const backup = await mkdtemp(path.join(backups, "pre-migration-"));
      await run("database-backup", pgCommand("pg_dump"), [
        "-h",
        temporary,
        "-U",
        "searchanvil",
        "--format=custom",
        "--file",
        path.join(backup, "postgres.dump"),
        "postgres",
      ]);
    }
    await run(
      "migration",
      node,
      [
        path.join(resources, "database", "node_modules", "prisma", "build", "index.js"),
        "migrate",
        "deploy",
        "--schema",
        path.join(schema, "schema.prisma"),
      ],
      env,
    );
    if (expectedMigration !== appliedMigration) {
      await writeFile(marker + ".new", expectedMigration, { mode: 0o600 });
      await rename(marker + ".new", marker);
    }

    const api = supervise("API", node, [path.join(resources, "api", "dist", "main.js")]);
    await waitUntilReady(
      `http://${host}:${apiPort}/ready`,
      {
        "x-searchanvil-desktop-capability": capability,
      },
      api,
      "SearchAnvil API",
    );

    const web = supervise(
      "Interface",
      node,
      [path.join(resources, "web", "apps", "web", "server.js")],
      {
        ...env,
        SEARCHANVIL_DESKTOP_CAPABILITY: "",
        DATABASE_URL: "",
        REDIS_URL: "",
      },
    );
    await waitUntilReady(`http://${host}:${webPort}/login`, {}, web, "SearchAnvil interface");
    await access(env.CHROMIUM_EXECUTABLE_PATH);
    const worker = supervise(
      "Worker",
      node,
      [path.join(resources, "worker", "dist", "main.js")],
      env,
      true,
    );
    await Promise.race([
      new Promise((resolve) => worker.child.once("message", resolve)),
      worker.exited.then((error) => {
        throw error ?? new Error("Worker exited during startup.");
      }),
      delay(15_000, undefined, { ref: false }).then(() => {
        throw new Error("Worker did not become ready.");
      }),
    ]);

    for (const process of processes) {
      process.exited.then((error) => {
        if (!stopping) onFailure(error ?? new Error(`${process.name} stopped unexpectedly.`));
      });
    }
    return { capability, origin, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

module.exports = { gateway, startRuntime };
