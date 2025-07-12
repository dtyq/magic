# ASR Token API - RESTful 接口

本文档描述了新的语音识别(ASR) JWT Token API，该API采用RESTful风格设计，支持用户鉴权和JWT Token缓存机制。

## API 概览

### 基础信息
- **基础路径**: `/api/v1/asr`
- **认证方式**: 需要用户登录认证（通过`RequestContextMiddleware`）
- **响应格式**: JSON
- **缓存机制**: 基于用户Magic ID的Redis缓存

## 接口列表

### 1. 获取ASR JWT Token

获取当前用户的语音识别JWT Token，支持缓存机制和token刷新。

**请求信息**
```
GET /api/v1/asr/tokens?refresh=false
```

**请求头**
```
Authorization: Bearer your_access_token
organization-code: your_organization_code
Content-Type: application/json
```

**查询参数**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| refresh | boolean | 否 | false | 是否强制刷新token，为true时会清除缓存并重新获取 |

**注意事项**
- Token有效期固定为7200秒（2小时），不接受外部传入duration参数
- 默认使用缓存机制，只有在token即将过期或缓存失效时才重新获取
- 当refresh=true时，会强制清除缓存并重新获取新token
- `duration` 字段行为：
  - 获取新token时：显示完整有效期（7200秒）
  - 返回缓存token时：显示剩余有效时间（动态计算）

**成功响应 (200)**
```json
{
    "success": true,
    "message": "ASR Token获取成功",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "app_id": "your_app_id",
        "duration": 7200,
        "expires_at": 1703847600,
        "resource_id": "volc.bigasr.sauc.duration",
        "user": {
            "magic_id": "user_magic_id_123",
            "user_id": "user_123",
            "organization_code": "org_456"
        }
    },
    "timestamp": 1703844000
}
```

### 2. 清除ASR JWT Token缓存

清除当前用户的语音识别JWT Token缓存。

**请求信息**
```
DELETE /api/v1/asr/tokens
```

**请求头**
```
Authorization: Bearer your_access_token
organization-code: your_organization_code
Content-Type: application/json
```

**成功响应 (200)**
```json
{
    "success": true,
    "message": "ASR Token缓存清除成功",
    "data": {
        "cleared": true,
        "message": "ASR Token缓存清除成功",
        "user": {
            "magic_id": "user_magic_id_123",
            "user_id": "user_123",
            "organization_code": "org_456"
        }
    },
    "timestamp": 1703844000
}
```

## 使用示例

### 获取Token（使用缓存）
```bash
curl -X GET "https://api.example.com/api/v1/asr/tokens" \
  -H "Authorization: Bearer your_access_token" \
  -H "organization-code: your_organization_code"
```

### 强制刷新Token
```bash
curl -X GET "https://api.example.com/api/v1/asr/tokens?refresh=true" \
  -H "Authorization: Bearer your_access_token" \
  -H "organization-code: your_organization_code"
```

### 清除Token缓存
```bash
curl -X DELETE "https://api.example.com/api/v1/asr/tokens" \
  -H "Authorization: Bearer your_access_token" \
  -H "organization-code: your_organization_code"
```

## 错误处理

### 常见错误码
- `INVALID_MAGIC_ID`: 用户Magic ID无效
- `INVALID_CONFIG`: ASR配置不完整
- `STS_TOKEN_REQUEST_FAILED`: JWT Token请求失败
- `STS_TOKEN_PARSE_RESPONSE_FAILED`: 响应解析失败

### 错误响应示例
```json
{
    "success": false,
    "message": "ASR配置不完整",
    "code": "INVALID_CONFIG",
    "timestamp": 1703844000
}
```

## 配置要求

确保在`.env`文件中配置了以下参数：

```env
# 火山引擎语音识别服务配置
ASR_VKE_APP_ID=your_volcengine_app_id
ASR_VKE_TOKEN=your_volcengine_access_token
```

## 性能优化

- **缓存机制**: 基于用户Magic ID的Redis缓存，避免频繁请求
- **智能过期**: 缓存时间比实际Token有效期提前30秒，避免边界问题
- **按需刷新**: 支持refresh参数进行强制刷新，满足特殊场景需求 