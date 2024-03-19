# 沙箱网关服务

沙箱网关服务提供了HTTP和WebSocket接口，允许客户端创建和管理沙箱Docker容器，并通过WebSocket连接与容器进行通信。

## 功能特点

- 创建隔离的沙箱Docker容器
- 分离沙箱创建和连接流程
- 提供RESTful API管理沙箱生命周期
- 通过WebSocket接口执行容器内的命令
- 自动清理闲置容器

## 前提条件

- Docker已安装
- Python 3.8+
- 沙箱容器镜像 `sandbox-websocket-image` 已构建

## 快速启动

使用提供的启动脚本即可启动服务：

```bash
./start.sh
```

默认情况下，服务将在端口8003上启动。如果需要指定其他端口，可以作为参数传递：

```bash
./start.sh 8080
```

## API 参考

### HTTP API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/sandboxes` | POST | 创建新的沙箱容器 |
| `/sandboxes` | GET | 获取所有沙箱容器列表 |
| `/sandboxes/{sandbox_id}` | GET | 获取指定沙箱的信息 |
| `/sandboxes/{sandbox_id}` | DELETE | 删除指定的沙箱容器 |

#### 创建沙箱

**请求：**
```
POST /sandboxes
```

**响应：**
```json
{
  "sandbox_id": "abcd1234",
  "status": "created",
  "message": "沙箱容器已创建成功"
}
```

#### 获取沙箱列表

**请求：**
```
GET /sandboxes
```

**响应：**
```json
[
  {
    "sandbox_id": "abcd1234",
    "status": "idle",
    "created_at": 1648371234.567,
    "ip_address": "172.17.0.2"
  },
  {
    "sandbox_id": "efgh5678",
    "status": "connected",
    "created_at": 1648371345.678,
    "ip_address": "172.17.0.3"
  }
]
```

#### 获取沙箱信息

**请求：**
```
GET /sandboxes/{sandbox_id}
```

**响应：**
```json
{
  "sandbox_id": "abcd1234",
  "status": "idle",
  "created_at": 1648371234.567,
  "ip_address": "172.17.0.2"
}
```

#### 删除沙箱

**请求：**
```
DELETE /sandboxes/{sandbox_id}
```

**响应：**
```json
{
  "message": "沙箱 abcd1234 已成功删除"
}
```

### WebSocket API

| 端点 | 描述 |
|------|------|
| `/ws/{sandbox_id}` | 连接到指定沙箱的WebSocket |

#### 连接到沙箱

WebSocket连接URL格式：
```
ws://localhost:8003/ws/{sandbox_id}
```

连接到此端点后，服务会：
1. 连接到指定的沙箱容器
2. 在客户端和容器之间建立双向通信
3. 连接断开时不会自动销毁容器，容器将变为闲置状态

## 消息格式

### 发送命令

```json
{
  "command": "ls -la",
  "request_id": "optional-unique-id"
}
```

如果不提供`request_id`，服务将自动生成一个。

### 接收响应

```json
{
  "request_id": "same-as-request",
  "command": "ls -la",
  "success": true,
  "output": "command output",
  "error": "error message if any",
  "returncode": 0,
  "timestamp": "2023-03-27T12:34:56.789"
}
```

## 使用流程

1. 通过HTTP接口创建沙箱：
   ```
   POST /sandboxes
   ```

2. 从响应中获取沙箱ID

3. 使用沙箱ID建立WebSocket连接：
   ```
   ws://localhost:8003/ws/{sandbox_id}
   ```

4. 通过WebSocket发送命令并接收结果

5. 使用完毕后，可以删除沙箱：
   ```
   DELETE /sandboxes/{sandbox_id}
   ```

## 安全注意事项

- 容器在默认的Docker桥接网络中运行
- 服务仅用于开发和测试环境，不建议在生产环境中直接使用
- 容器会在闲置一小时后自动清理
- 沙箱ID应妥善保管，任何了解沙箱ID的人都可以通过WebSocket接口访问容器 