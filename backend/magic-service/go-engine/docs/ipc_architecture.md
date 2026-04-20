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
- 当前生产/测试链路里，Go 由 PHP 启动阶段触发自启动；Go 启动失败时，PHP 继续以降级模式存活

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

---

## 5. 启动链路

### 生产 / 测试环境

1. 容器入口执行 [`backend/magic-service/start.sh`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/start.sh)
2. `start.sh` 先执行 `shell:locker migrate`
3. `start.sh` 启动 PHP：`php bin/hyperf.php start`
4. PHP 进入 `MainCoroutineServerStart`
5. [`StartRpcClientListener`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/app/Infrastructure/Rpc/Listener/StartRpcClientListener.php#L58) 检查 Go socket 是否已可连
6. 若不可连，则用 `proc_open(['/bin/sh', '-c', 'cd ... && CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine'])` 拉起 Go
7. PHP 等待 socket ready，随后启动 `RpcClientManager`
8. PHP 与 Go 完成 `ipc.hello` 握手并开始心跳

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
- Go 收到 `SIGINT/SIGTERM` 后会走优雅关闭
- PHP 退出时，`StartRpcClientListener` 只会停止 PHP 侧 `RpcClientManager`，不会在 PHP 内显式托管 Go 的整个生命周期

### 故障策略

- Go 启动失败：
  - PHP 记录错误
  - PHP 继续存活，进入降级模式
- Go 运行中断开：
  - PHP 侧 `RpcClientManager` 按既有重试策略重连
- PHP 不会因为 Go 不可用而立即退出

这也是当前 `/heartbeat` 需要单独看待的原因：它反映的是运行健康状态，不是容器内进程编排器。

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

因此：

- PHP 活着但 Go 未连通时，服务可以继续运行
- 但 `/heartbeat` 可能会因为 Go 不健康而返回失败，是否把它接成 liveness/readiness 需要部署侧自行决定

---

## 9. 当前配置约束

### PHP 侧

- IPC 配置文件：[`backend/magic-service/config/autoload/ipc.php`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/config/autoload/ipc.php)
- 默认 Go 启动命令：`CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine`
- 默认 Go socket：`BASE_PATH/runtime/magic_engine.sock`

### Go 侧

- 正式配置文件：[`backend/magic-service/magic-go-engine-config.yaml`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/magic-go-engine-config.yaml)
- 当前共享 env：[`backend/magic-service/.env`](/Users/liangpeng/Documents/kk/magic/backend/magic-service/.env)
- `ipc.engineSocket` 默认值：`./runtime/magic_engine.sock`

---

## 10. 审阅检查清单

- PHP 入口脚本是否仍只启动 PHP，而不是双进程编排
- Go 默认配置文件名是否统一为 `magic-go-engine-config.yaml`
- PHP 默认启动命令、Go loader、开发态 air 运行命令是否都指向同一个配置文件
- `magic-service/.env` 是否仍是 PHP 与 Go 共用的环境变量入口
- `/heartbeat` 的部署语义是否与当前“Go 可降级、PHP 继续存活”的策略一致
