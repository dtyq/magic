# RPC over IPC 架构说明（magic-service ↔ go-engine）

## 1. 文档目标

本文档只描述**当前代码实现**，不描述已经废弃或尚未落地的方案。重点回答四件事：

- PHP 与 Go 现在如何建立 IPC 通道；
- Go 进程由谁启动、何时启动；
- 配置文件和环境变量现在从哪里读取；
- 进程退出、重连、健康检查现在是什么行为。

---

## 2. 当前架构结论

- 协议层：`JSON-RPC 2.0`
- 传输层：`Unix Domain Socket + 4-byte big-endian length prefix`
- Go 角色：IPC 服务端，监听 `runtime/magic_engine.sock`
- PHP 角色：IPC 客户端，连接 Go；同时暴露一组 RPC 方法供 Go 回调
- 部署关系：PHP 与 Go 仍然运行在同一个 `magic-service` 工作目录下，但**不是**入口脚本双进程编排模式
- 当前生产/测试链路里，Go 由 PHP 启动阶段触发自启动，并由 PHP 内建 supervisor 托管生命周期；Go 启动失败时，PHP 继续以降级模式存活

---

## 3. 代码落位

### PHP 侧

#### 启动与生命周期
- [`backend/magic-service/start.sh`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/start.sh)
  - 只负责迁移并启动 PHP
  - 不直接拉起 Go
- [`backend/magic-service/app/Infrastructure/Rpc/Listener/StartRpcClientListener.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/Listener/StartRpcClientListener.php)
  - 在 `MainCoroutineServerStart` 时尝试启动 Go
  - 然后启动 PHP 侧 `RpcClientManager`
- [`backend/magic-service/app/Infrastructure/Rpc/Lifecycle/GoEngineBootstrapService.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/Lifecycle/GoEngineBootstrapService.php)
  - 负责首次启动决策：复用已有连接、等待已有 socket，或启动新的 Go 进程
  - 首次启动完成后把 Go 进程句柄交给 supervisor
- [`backend/magic-service/app/Infrastructure/Rpc/Lifecycle/GoEngineSupervisor.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/Lifecycle/GoEngineSupervisor.php)
  - 常驻协程托管 Go 进程生命周期
  - 负责检测进程退出、RPC 长时间不健康和 stale socket，并按需重启 Go
- [`backend/magic-service/app/Infrastructure/Rpc/Lifecycle/GoEngineProcessStarter.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/Lifecycle/GoEngineProcessStarter.php)
  - 默认使用结构化 `proc_open([$executable, ...$args], ..., $workDir, $env)` 启动 Go
  - 不经过 shell，不支持 legacy command 分支

#### RPC Runtime
- [`backend/magic-service/app/Infrastructure/Rpc/JsonRpc/JsonRpcRuntimeClient.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/JsonRpc/JsonRpcRuntimeClient.php)
- [`backend/magic-service/app/Infrastructure/Rpc/JsonRpc/RpcClientManager.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/JsonRpc/RpcClientManager.php)
- [`backend/magic-service/app/Infrastructure/Rpc/Registry/RpcServiceRegistry.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/Registry/RpcServiceRegistry.php)

#### IPC Transport
- [`backend/magic-service/app/Infrastructure/Transport/Ipc/Uds/UdsFramedTransport.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Transport/Ipc/Uds/UdsFramedTransport.php)

#### 配置
- [`backend/magic-service/config/autoload/ipc.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/config/autoload/ipc.php)

### Go 侧

#### 配置加载
- [`backend/magic-service/go-engine/internal/config/loader.go`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/internal/config/loader.go)

#### IPC Transport / Runtime
- [`backend/magic-service/go-engine/internal/infrastructure/transport/ipc/unixsocket/server.go`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/internal/infrastructure/transport/ipc/unixsocket/server.go)
- [`backend/magic-service/go-engine/internal/infrastructure/rpc/jsonrpc/server.go`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/internal/infrastructure/rpc/jsonrpc/server.go)
- [`backend/magic-service/go-engine/internal/infrastructure/rpc/jsonrpc/session.go`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/internal/infrastructure/rpc/jsonrpc/session.go)

#### Go -> PHP 回调客户端
- [`backend/magic-service/go-engine/internal/infrastructure/rpc/jsonrpc/client`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/internal/infrastructure/rpc/jsonrpc/client)

#### 开发态启动
- [`backend/magic-service/Makefile`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/Makefile)
- [`backend/magic-service/go-engine/start.sh`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/start.sh)
- [`backend/magic-service/go-engine/.air.toml`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/.air.toml)

---

## 4. 配置来源

### Go 配置文件

Go 当前正式使用的仓库内配置文件名是：

- [`backend/magic-service/magic-go-engine-config.yaml`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/magic-go-engine-config.yaml)

Go loader 的默认查找顺序：

1. `CONFIG_FILE` 显式指定的路径
2. 当前工作目录下的 `./magic-go-engine-config.yaml`
3. 父目录 `../magic-go-engine-config.yaml`

对应实现见 [`backend/magic-service/go-engine/internal/config/loader.go`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/internal/config/loader.go#L23)。

### 环境变量

Go 不再使用独立 `.env`。当前共享环境变量来源是：

- [`backend/magic-service/.env`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/.env)
- [`backend/magic-service/.env.example`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/.env.example)

Go loader 会优先读取当前工作目录 `.env`，否则读取父目录 `magic-service/.env`，见 [`backend/magic-service/go-engine/internal/config/loader.go`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/internal/config/loader.go#L117)。

### PHP IPC 配置

PHP 侧 IPC 启动和连接参数来自：

- [`backend/magic-service/config/autoload/ipc.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/config/autoload/ipc.php)

当前默认 Go 启动命令是：

```bash
CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine
```

它是展示用等价命令。当前实现不是通过 shell 执行这串命令，而是结构化启动：

- `workDir`: `BASE_PATH`
- `executable`: `./bin/magic-go-engine`
- `arguments`: `[]`
- `environment.CONFIG_FILE`: `./magic-go-engine-config.yaml`

PHP 会把当前进程环境变量传给 Go，并覆盖/补充 `CONFIG_FILE`。

---

## 5. 启动链路

### 生产 / 测试环境

1. 容器入口执行 [`backend/magic-service/start.sh`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/start.sh)
2. `start.sh` 先执行 `shell:locker migrate`
3. `start.sh` 启动 PHP：`php bin/hyperf.php start`
4. PHP 进入 `MainCoroutineServerStart`
5. [`StartRpcClientListener`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/Listener/StartRpcClientListener.php#L58) 检查 Go socket 是否已可连
6. 若不可连且允许自动启动，则用 structured `proc_open` 拉起 Go
7. PHP 启动 `RpcClientManager`，等待 Go socket ready
8. PHP 与 Go 完成 `ipc.hello` 握手并开始心跳
9. PHP 启动 `GoEngineSupervisor` 常驻协程，托管 Go 进程后续生命周期

默认 structured 启动等价于：

```bash
cd /opt/www && CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine
```

实际实现是直接 argv 执行，因此 PHP 记录的 pid 就是 Go 进程 pid。

### 本地开发

1. 在 [`backend/magic-service/Makefile`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/Makefile#L12) 下执行 `make dev`
2. `make dev` 先清理旧 PHP / Go 进程和旧 socket
3. `make dev` 调用 `make -C ./go-engine dev`
4. Go 侧 `start.sh -w` 通过 `air` 热重载，但构建产物仍输出到：
   - [`backend/magic-service/bin/magic-go-engine`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/bin/magic-go-engine)
5. `air` 实际运行命令是：

```bash
cd .. && CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine
```

6. Go socket ready 后，`make dev` 再执行 `php bin/hyperf.php server:watch`

结论：开发态虽然用了 `air` 和 `server:watch`，但 Go 真正运行的二进制路径、工作目录和配置文件路径都与线上保持一致。

---

## 6. IPC 协议与运行时行为

### 分帧

- 帧格式：`[4-byte length][json body]`
- 编码：UTF-8 JSON
- 默认消息上限：`IPC_MAX_MESSAGE_BYTES`

### 系统方法

- `ipc.hello`
- `ipc.ping`

未完成握手前，只允许系统方法。

### 业务方法命名

- 统一命名空间：`svc.*`
- 方法常量落在：
  - Go: [`backend/magic-service/go-engine/internal/constants/svc_rpc_methods.go`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/go-engine/internal/constants/svc_rpc_methods.go)
  - PHP: [`backend/magic-service/app/Infrastructure/Rpc/Method/SvcMethods.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/Method/SvcMethods.php)

### 调用方向

- PHP -> Go
  - 由 PHP `JsonRpcRuntimeClient` 发起
  - 通过 UDS 调 Go `internal/interfaces/rpc/jsonrpc/...` 下的 handler
- Go -> PHP
  - 由 Go `php_*_rpc_client.go` 发起回调
  - PHP 侧由 `RpcServiceRegistry` 注册并分发

---

## 7. 生命周期与故障行为

### Go 进程生命周期

- Go 不是容器入口脚本直接拉起的，而是 PHP 启动阶段按需拉起
- 默认启动方式是 structured `proc_open`，PHP 持有 Go 进程句柄
- Go 收到 `SIGINT/SIGTERM` 后会走优雅关闭
- PHP 退出时，`GoEngineBootstrapService::shutdown()` 会先停止 supervisor，再停止 PHP 侧 `RpcClientManager`
- supervisor 停止时会终止当前托管的 Go 进程，避免 PHP shutdown 期间误重启

### 故障策略

- Go 启动失败：
  - PHP 记录错误
  - PHP 继续存活，进入降级模式
- Go 运行中进程退出：
  - supervisor 记录 `process_exited`，关闭旧 RPC client，清理 stale socket，并重新启动 Go
- RPC 断开但 Go 进程仍运行：
  - `RpcClientManager` 先按既有 keepalive 策略重连
  - 超过 `IPC_ENGINE_SUPERVISOR_RPC_UNHEALTHY_SECONDS` 后，supervisor 终止并重启 Go
- Go 重启失败：
  - supervisor 按 backoff 重试
  - PHP 请求线程不参与拉起 Go，请求仍 fail-fast
- PHP 不会因为 Go 不可用而立即退出

这也是当前 `/heartbeat` 需要单独看待的原因：它反映的是运行健康状态，不会在探针请求里触发启动、重启或真实 UDS 探测。

---

## 8. 健康检查

统一健康口是：

- `GET /heartbeat`

当前行为：

- `php_up` 反映 PHP 主进程是否正常
- `rpc_client_enabled` 反映是否开启 IPC 客户端
- `rpc_connected` 直接反映 `RpcClientManager` 当前是否已连通
- `socket_connectable` 是兼容字段，现与 `rpc_connected` 同步，不再触发真实 UDS 探测
- `go_alive` 表示当前 RPC 状态是否仍处于可接受区间：`ready` 与 `degraded` 为 `true`
- `meta.supervisor` 暴露 PHP supervisor 的只读状态：
  - `enabled`
  - `running`
  - `restarting`
  - `go_pid`
  - `go_pid_type`
  - `go_uptime_seconds`
  - `restart_count`
  - `last_restart_reason`
  - `last_exit_code`
  - `current_backoff_ms`

因此：

- PHP 活着但 Go 未连通时，服务可以继续运行
- 但 `/heartbeat` 可能会因为 Go 不健康而返回失败，是否把它接成 liveness/readiness 需要部署侧自行决定

---

## 9. 当前配置约束

### PHP 侧

- IPC 配置文件：[`backend/magic-service/config/autoload/ipc.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/config/autoload/ipc.php)
- 默认 Go 启动方式：结构化 `proc_open([$executable, ...$args], ..., $workDir, $env)`
- 默认 Go executable：`./bin/magic-go-engine`
- 默认 Go config file：`./magic-go-engine-config.yaml`
- 默认 Go 等价启动命令：`CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine`
- 默认 Go socket：`BASE_PATH/runtime/magic_engine.sock`

关键环境变量：

- `IPC_ENGINE_EXECUTABLE`
- `IPC_ENGINE_ARGUMENTS_JSON`
- `IPC_ENGINE_CONFIG_FILE`
- `IPC_ENGINE_ENV_JSON`
- `IPC_ENGINE_SUPERVISOR_ENABLED`
- `IPC_ENGINE_SUPERVISOR_INTERVAL_SECONDS`
- `IPC_ENGINE_SUPERVISOR_RPC_UNHEALTHY_SECONDS`
- `IPC_ENGINE_SUPERVISOR_RESTART_BACKOFF_MS`
- `IPC_ENGINE_SUPERVISOR_RESTART_MAX_BACKOFF_MS`
- `IPC_ENGINE_SUPERVISOR_TERMINATE_GRACE_SECONDS`

### Go 侧

- 正式配置文件：[`backend/magic-service/magic-go-engine-config.yaml`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/magic-go-engine-config.yaml)
- 当前共享 env：[`backend/magic-service/.env`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/.env)
- `ipc.engineSocket` 默认值：`./runtime/magic_engine.sock`

---

## 10. 审阅检查清单

- PHP 入口脚本是否仍只启动 PHP，而不是双进程编排
- Go 默认配置文件名是否统一为 `magic-go-engine-config.yaml`
- PHP structured 启动、Go loader、开发态 air 运行命令是否都指向同一个配置文件
- `magic-service/.env` 是否仍是 PHP 与 Go 共用的环境变量入口
- supervisor 是否只在 `IPC_RPC_CLIENT_ENABLED=true`、`IPC_ENGINE_AUTO_START=true`、`IPC_ENGINE_SUPERVISOR_ENABLED=true` 时启用
- 请求线程是否仍保持 fail-fast，不在业务请求里启动或重启 Go
- `/heartbeat` 的部署语义是否与当前“Go 可降级、PHP 继续存活”的策略一致
