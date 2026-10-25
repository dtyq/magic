---
name: vibe-coding
description: Use when a request needs a real code project with a toolchain, such as a React, Vue, or Vite frontend, a backend service (FastAPI, Flask, Express, Django), a compiled language project, or cloning and modifying an existing repository. Also use before running npm install, pnpm install, yarn, pip install, uv sync, poetry install, composer install, go build, or cargo build; before starting a dev server or binding a port; and when a project already contains node_modules, vendor, .venv, or a lockfile. Trigger phrases include "搭个项目", "做个后端", "帮我改这个项目", "起个本地服务", "npm install". For interactive HTML apps without a build step, use html-app-architect; for published micro-apps, use micro-app-architect.
---

# Vibe Coding

Build and run real code projects without filling the workspace with tiny files or handing the user addresses they cannot open.

## 1. Route first

- Interactive pages, tools, or dashboards that work without a build step: use `html-app-architect` instead.
- Published micro-apps: use `micro-app-architect` instead.
- Continue here only when the task truly needs a package manager, a build step, or a running service.

Then read the first line of the `Runtime Environment` section in the system prompt:

| Runtime | Sections that apply |
| --- | --- |
| `cloud sandbox` | All sections |
| `local machine` | Section 6 only. Install and build with each tool's defaults; skip the storage rules in sections 2-5, 7, and 8. |

## 2. Where files go (cloud sandbox only)

Two rules from the system prompt, expanded per ecosystem:

| Ecosystem | Keep in the project, install in place | Point into `$MAGIC_BOX_DIR` |
| --- | --- | --- |
| Node.js | `node_modules`. Vite keeps its cache in `node_modules/.vite`, so it needs nothing. | TypeScript `tsBuildInfoFile`, Jest `cacheDirectory`, other tool caches |
| Python | `.venv`. Bytecode already goes to local disk through `PYTHONPYCACHEPREFIX`. | pytest `cache_dir`, mypy `cache_dir`, ruff `cache-dir` |
| PHP | `vendor` | - |
| Rust | - | `CARGO_TARGET_DIR="$MAGIC_BOX_DIR/<project>/target"` |
| Go | Module and build caches already live in `~/go` and `~/.cache`. | - |
| Java / Kotlin | - | `GRADLE_USER_HOME`, Maven `-Dmaven.repo.local=...` |

In config files, read the variable instead of writing a fixed path, for example `process.env.MAGIC_BOX_DIR` in a Node config or `os.environ["MAGIC_BOX_DIR"]` in Python.

## 3. Frameworks with fixed build directories (cloud sandbox only)

`.next`, `.nuxt`, `.svelte-kit`, `.angular`, and similar directories are fixed by the framework and create many files in network storage. Unless the user asks for such a framework, prefer a stack whose caches can be moved, such as a Vite SPA. When one of them is required, tell the user that installs and builds will be slower before you start.

## 4. Uploaded or imported projects (cloud sandbox only)

Dependency directories that arrived by upload or import stay in network storage and are slow. Check them before doing anything else:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("inspect_path_storage", {"paths": ["my-app/node_modules", "my-app/.venv"]})
print(result.content)
""")
```

If a dependency directory is reported as network storage, delete only that directory, reinstall it with the package manager, and tell the user why. Do not delete anything else.

## 5. Build output (cloud sandbox only)

Build output the user needs stays in `.workspace` so they can browse it. Estimate the file count before building and keep it small. A Vite example that needs no extra plugins:

```js
// vite.config.js
export default {
  build: {
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
};
```

## 6. Running servers (both runtimes)

- Start servers with `shell_exec(command="...", allow_background=True)`, bind `127.0.0.1`, check them with `curl`, then stop them with `shell_await(task_id="<id>", timeout=0, kill=True)`.
- Bind `0.0.0.0` only when the service itself checks a strong, unguessable credential and rejects unauthenticated requests.
- Cloud sandbox: never give the user a localhost address. Deliver code and build output, and tell the user which file to open in the file tree, for example `my-app/dist/index.html`.
- Local machine: you may share `http://127.0.0.1:<port>`, and say that it only opens in a browser on the same machine.

## 7. After a sandbox rebuild (cloud sandbox only)

A rebuild empties local disk, including `node_modules`, `.venv`, and `vendor`. After dependencies are installed for the first time, ask the user whether they should be reinstalled automatically every time the sandbox starts. If the user agrees, read `startup-manager`.

Startup tasks run in the background and do not need to be awaited in advance. When a command fails with a missing dependency or module:

1. Call `startup_task_list`.
2. If a task for that project is still running, wait for it with `shell_await` on its background task ID, then retry.
3. If it failed or was skipped, read the reason in the result, fix or install manually, and tell the user.

Before installing dependencies yourself, also call `startup_task_list` so you do not install into the same directory as a running startup task.

## 8. Check storage (cloud sandbox only)

Use `inspect_path_storage` whenever you are unsure where a path lives. Do not measure write speed with timing tests.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("inspect_path_storage", {"paths": ["my-app/node_modules", "my-app/dist", "/tmp/build"]})
print(result.content)
""")
```

| Reported storage | Meaning |
| --- | --- |
| network storage | Persisted and visible to the user; each new small file takes about 2 seconds to write and counts toward the plan's file and storage limits |
| local dependency directory | Fast local disk inside the project; emptied on rebuild and reinstalled by the package manager |
| container-local disk | Fast, hidden from the user, wiped on rebuild |
| platform-managed internal storage | Used by the platform itself; do not put project files there |

A path that does not exist yet is judged by its nearest existing parent, which tells you where a new directory would be created.
