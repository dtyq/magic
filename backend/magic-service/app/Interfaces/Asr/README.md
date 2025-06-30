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

获取当前用户的语音识别JWT Token，支持缓存机制。

**请求信息**
```
GET /api/v1/asr/tokens?duration=3600
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
| duration | integer | 否 | 3600 | Token有效期（秒），范围：300-86400 |

**成功响应 (200)**
```json
{
    "success": true,
    "message": "ASR Token获取成功",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "app_id": "your_app_id",
        "duration": 3600,
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

## 配置要求

确保在`.env`文件中配置了以下参数：

```env
# 火山引擎语音识别服务配置
ASR_VKE_APP_ID=your_volcengine_app_id
ASR_VKE_TOKEN=your_volcengine_access_token
``` 