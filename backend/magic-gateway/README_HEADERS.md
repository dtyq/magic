# Magic Gateway Header 透传功能

## 概述

Magic Gateway 现在支持透传 `magic-user-id` 和 `magic-organization-code` header 到所有代理的 API 请求中。

## 支持的 Header

### magic-user-id
- **描述**: 用户唯一标识符
- **类型**: String
- **示例**: `magic-user-id: user123`

### magic-organization-code
- **描述**: 组织代码标识符
- **类型**: String
- **示例**: `magic-organization-code: org456`

## 使用方法

### 1. 认证时设置 Header

在调用 `/auth` 端点时，可以设置这些 header：

```bash
curl -X POST http://localhost:8000/auth \
  -H "X-Gateway-API-Key: your-api-key" \
  -H "magic-user-id: user123" \
  -H "magic-organization-code: org456"
```

### 2. API 代理请求时透传

在通过网关代理 API 请求时，这些 header 会自动透传到目标服务：

```bash
curl -X POST http://localhost:8000/openai/v1/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "magic-user-id: user123" \
  -H "magic-organization-code: org456" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 3. 兼容性

为了保持向后兼容性，网关还支持以下 header：

- `X-USER-ID` - 如果 `magic-user-id` 不存在，会使用此值
- `X-Container-ID` - 在服务列表请求中使用

## 日志记录

当启用调试模式时，网关会记录 header 透传的详细信息：

```
透传magic-user-id: user123
透传magic-organization-code: org456
```

## 目标服务接收

目标 API 服务将收到包含这些 header 的请求：

```
magic-user-id: user123
magic-organization-code: org456
```

## 注意事项

1. Header 名称区分大小写
2. 如果 header 值为空，不会被透传
3. 这些 header 不会被 `shouldSkipHeader` 函数过滤
4. 支持所有代理的 API 端点

## 测试

可以使用以下命令测试功能：

```bash
# 启动网关服务
go run main.go

# 测试认证
curl -X POST http://localhost:8000/auth \
  -H "X-Gateway-API-Key: your-api-key" \
  -H "magic-user-id: test-user" \
  -H "magic-organization-code: test-org"

# 测试代理请求
curl -X POST http://localhost:8000/openai/v1/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "magic-user-id: test-user" \
  -H "magic-organization-code: test-org" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello"}]}'
```
