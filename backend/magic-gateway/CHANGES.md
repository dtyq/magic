# Magic Gateway Header 透传功能变更日志

## 变更概述

本次更新为 Magic Gateway 添加了对 `magic-user-id` 和 `magic-organization-code` header 的透传支持，确保这些 header 能够从客户端传递到所有代理的 API 服务。

## 主要变更

### 1. 认证处理程序 (`authHandler`)
- 添加了对 `magic-user-id` 和 `magic-organization-code` header 的读取
- 保持向后兼容性，如果 `magic-user-id` 不存在，会使用 `X-USER-ID`
- 如果 `magic-organization-code` 为空，使用默认值 "default-organization"

### 2. 代理处理程序 (`proxyHandler`)
- 在代理请求中读取 `magic-user-id` 和 `magic-organization-code` header
- 将这些 header 透传到目标 API 服务
- 添加了调试模式下的日志记录，显示透传的 header 信息

### 3. 服务列表处理程序 (`servicesHandler`)
- 添加了对 `magic-user-id` 和 `magic-organization-code` header 的支持
- 如果 `X-Container-ID` 为空但 `magic-user-id` 存在，使用 `magic-user-id`
- 更新了日志记录，包含用户和组织信息

### 4. 环境变量处理程序 (`envHandler`)
- 添加了对 `magic-user-id` 和 `magic-organization-code` header 的支持
- 如果 `X-USER-ID` 为空但 `magic-user-id` 存在，使用 `magic-user-id`
- 更新了日志记录，包含用户和组织信息

## 技术细节

### Header 处理逻辑
```go
// 获取用户信息
userID := r.Header.Get("X-USER-ID")
magicUserID := r.Header.Get("magic-user-id")
magicOrganizationCode := r.Header.Get("magic-organization-code")

// 如果X-USER-ID为空但magic-user-id存在，使用magic-user-id
if userID == "" && magicUserID != "" {
    userID = magicUserID
}
```

### Header 透传逻辑
```go
// 透传magic-user-id和magic-organization-code到目标API
if magicUserID != "" {
    proxyReq.Header.Set("magic-user-id", magicUserID)
    if debugMode {
        logger.Printf("透传magic-user-id: %s", magicUserID)
    }
}

if magicOrganizationCode != "" {
    proxyReq.Header.Set("magic-organization-code", magicOrganizationCode)
    if debugMode {
        logger.Printf("透传magic-organization-code: %s", magicOrganizationCode)
    }
}
```

## 兼容性

- ✅ 保持对现有 `X-USER-ID` 和 `X-Container-ID` header 的完全兼容
- ✅ 新增的 header 不会影响现有功能
- ✅ 所有现有的 API 调用方式仍然有效

## 测试建议

1. **认证测试**: 使用新的 header 进行认证
2. **代理测试**: 通过网关代理 API 请求，验证 header 透传
3. **兼容性测试**: 使用旧的 header 确保功能正常
4. **调试模式测试**: 启用调试模式验证日志记录

## 使用示例

### 认证请求
```bash
curl -X POST http://localhost:8000/auth \
  -H "X-Gateway-API-Key: your-api-key" \
  -H "magic-user-id: user123" \
  -H "magic-organization-code: org456"
```

### API 代理请求
```bash
curl -X POST http://localhost:8000/openai/v1/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "magic-user-id: user123" \
  -H "magic-organization-code: org456" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello"}]}'
```

## 注意事项

1. Header 名称区分大小写
2. 空值的 header 不会被透传
3. 调试模式下会记录详细的透传信息
4. 这些 header 不会被 `shouldSkipHeader` 函数过滤
