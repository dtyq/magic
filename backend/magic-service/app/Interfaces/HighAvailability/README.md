# 高可用性 API 接口

## 概述

高可用性 API 接口提供了获取模型端点列表的功能，用于支持负载均衡和高可用性选择。

## 接口列表

### 获取模型端点列表

**接口地址：** `GET /api/v1/high-available/models/endpoints`

**功能描述：** 根据端点类型和组织代码获取可用的端点列表，支持按提供商和端点名称进行过滤。

#### 请求参数

**查询参数：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| endpoint_type | string | 是 | 端点类型/模型ID，例如：gpt-4.1 |
| provider | string | 否 | 服务提供商配置ID |
| endpoint_name | string | 否 | 端点名称（可选），例如：East US, Japan for Microsoft provider |

**请求头：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| organization-code | string | 是 | 组织代码 |
| Authorization | string | 是 | 认证token |

**请求体（可选）：**
```json
{
    "endpoint_type": "gpt-4.1"
}
```

注意：`endpoint_type` 参数可以通过查询参数或请求体提供，如果两者都存在，优先使用查询参数。

#### 响应格式

```json
{
    "code": 200,
    "message": "success",
    "data": [
        {
            "business_id": "123",
            "endpoint_id": "456",
            "type": "model_gateway",
            "provider": "openai",
            "name": "GPT-4",
            "config": "{}",
            "resources": ["resource1", "resource2"],
            "enabled": true,
            "circuit_breaker_status": "closed",
            "created_at": "2024-01-01 00:00:00",
            "updated_at": "2024-01-01 00:00:00"
        }
    ]
}
```

#### 错误响应

缺少 endpoint_type 参数：
```json
{
    "code": 400,
    "message": "缺少必需参数：endpoint_type"
}
```

缺少 organization-code 请求头：
```json
{
    "code": 400,
    "message": "缺少必需参数：organization-code 请求头"
}
```

#### 使用示例

```bash
# 基本请求（使用查询参数）
curl -X GET "http://127.0.0.1:9501/api/v1/high-available/models/endpoints?endpoint_type=gpt-4.1" \
  --header "authorization: YOUR_TOKEN" \
  --header "organization-code: 6cf302i4j51j"

# 带过滤条件的请求
curl -X GET "http://127.0.0.1:9501/api/v1/high-available/models/endpoints?endpoint_type=gpt-4.1&provider=openai&endpoint_name=us-east" \
  --header "authorization: YOUR_TOKEN" \
  --header "organization-code: 6cf302i4j51j"

# 使用请求体的方式（您的curl请求示例）
curl --location --request GET 'http://127.0.0.1:9501/api/v1/high-available/models/endpoints' \
  --header 'authorization: eyJhbGciOiJIUzI1NiIsInR5cGUiOiJKV1QifQ==.eyJpc3MiOjU5NTY5MzM5NjYxMTQ3MzQwOCwiZXhwIjoxNzQ3MTA3MTMzLCJzdWIiOiJKc29uIFdlYiBUb2tlbiIsImF1ZCI6bnVsbCwibmJmIjpudWxsLCJpYXQiOjE3NDcwMjA3MzMsImp0aSI6NzgwMzk1MjgwMzcyNDM2OTk0LCJjdXMiOnsiZGV2aWNlX2lkIjoiMjczZTE2NGZhMzA0YmVlYzNlNGQzNDZkOGNjOTlhZDdlOWQ1MjEwMDljZjc3MTk5MDdkOWVhN2RiNWZkMTE0ZCIsInRlbmFudF9pZCI6NTg4NDE3MjE1NzkxODkwNDMzfX0=.6c5438a4fc3e7dbf2683f1d15099b198f73346777a883c75cb3a92b549d1e1ec' \
  --header 'organization-code: 6cf302i4j51j' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "endpoint_type": "gpt-4.1"
  }'
```

## 依赖服务

- `ModelGatewayEndpointProvider`: 负责从模型网关业务模块获取端点列表
- `ServiceProviderDomainService`: 提供服务提供商相关的业务逻辑

## 测试

运行测试用例：

```bash
./vendor/bin/phpunit test/Cases/HighAvailability/HighAvailabilityApiTest.php
``` 