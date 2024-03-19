# SDK Base - HTTP 请求基础框架

## 简介

SDK Base 是一个轻量级的 HTTP 请求基础框架，专为构建各种业务 API SDK 而设计。它提供了简洁、灵活的基础设施，让你可以快速构建稳定的 HTTP 客户端。

## 核心特性

✅ **简洁设计** - 参考 PHP 版本的简洁理念，去除过度设计
✅ **双模式支持** - 同时支持同步和异步 HTTP 请求
✅ **灵活日志** - 支持禁用日志、默认日志或集成 AgentLang Logger
✅ **配置灵活** - 简单的字典配置，支持点号分割访问
✅ **上下文管理** - 全局 SDK 实例管理
✅ **纯净基础** - 不处理认证逻辑，由业务 API 自行实现
✅ **完整测试** - 包含单元测试和真实 API 集成测试

## 快速开始

### 1. 基本使用

```python
from app.infrastructure.sdk.base import SdkBase, AbstractApi

# 配置 SDK
config = {
    'sdk_name': 'my_api_sdk',
    'base_url': 'https://api.example.com',
    'timeout': 30
}

# 创建 SDK 基础实例
sdk_base = SdkBase(config)

# 定义业务 API 类
class MyApi(AbstractApi):
    def get_user_info(self, user_id):
        return self.request('GET', f'/users/{user_id}')

    def create_user(self, user_data):
        return self.request('POST', '/users', data=user_data)

# 使用 API
api = MyApi(sdk_base)
response = api.get_user_info(123)
print(response.json())

# 记得关闭
sdk_base.close()
```

### 2. 异步使用

```python
import asyncio
from app.infrastructure.sdk.base import SdkBase, AbstractApi

class AsyncApi(AbstractApi):
    async def get_user_info_async(self, user_id):
        return await self.async_request('GET', f'/users/{user_id}')

async def main():
    config = {
        'sdk_name': 'async_api_sdk',
        'base_url': 'https://api.example.com'
    }

    sdk_base = SdkBase(config)
    api = AsyncApi(sdk_base)

    # 并发请求
    tasks = [
        api.get_user_info_async(1),
        api.get_user_info_async(2),
        api.get_user_info_async(3)
    ]

    responses = await asyncio.gather(*tasks)
    for response in responses:
        print(response.json())

    sdk_base.close()

# 运行异步代码
asyncio.run(main())
```

## 配置选项

### 基础配置

```python
config = {
    # 必需配置
    'sdk_name': 'my_sdk',           # SDK 名称，用于日志标识
    'base_url': 'https://api.com',  # API 基础 URL

    # 可选配置
    'timeout': 30,                  # 请求超时时间（秒）
    'enable_logging': True,         # 是否启用日志（默认 True）
    'log_level': 'INFO',           # 日志级别（INFO/DEBUG/WARNING/ERROR）
}
```

### 高级配置示例

```python
config = {
    'sdk_name': 'advanced_sdk',
    'base_url': 'https://api.example.com',
    'timeout': 60,
    'enable_logging': True,
    'log_level': 'DEBUG',

    # 你可以添加任何自定义配置
    'api_version': 'v1',
    'retry_times': 3,
    'custom_setting': 'value'
}

sdk_base = SdkBase(config)

# 读取配置
config_obj = sdk_base.get_config()
print(config_obj.get('api_version'))        # v1
print(config_obj.get('custom_setting'))     # value
print(config_obj.get('nonexistent', 'default'))  # default
```

## 日志功能

### 1. 默认日志（LoggerProxy）

```python
# 启用日志（默认行为）
config = {
    'sdk_name': 'logged_sdk',
    'base_url': 'https://api.example.com',
    'enable_logging': True,  # 可省略，默认为 True
    'log_level': 'INFO'
}

sdk_base = SdkBase(config)
# 会输出详细的请求/响应日志
```

### 2. 禁用日志

```python
# 完全静默运行
config = {
    'sdk_name': 'silent_sdk',
    'base_url': 'https://api.example.com',
    'enable_logging': False  # 禁用所有日志输出
}

sdk_base = SdkBase(config)
# 不会有任何日志输出
```

### 3. 使用 AgentLang Logger

```python
from app.infrastructure.sdk.base import SdkBase, create_agentlang_logger

# 创建 AgentLang 日志器
agentlang_logger = create_agentlang_logger('agentlang_sdk')

config = {
    'sdk_name': 'agentlang_sdk',
    'base_url': 'https://api.example.com'
}

# 传入外部日志器
sdk_base = SdkBase(config, external_logger=agentlang_logger)

# 现在会使用 AgentLang 的 loguru 格式输出日志
```

### 4. 动态控制日志

```python
sdk_base = SdkBase(config)

# 运行时禁用日志
sdk_base.get_config().set('enable_logging', False)

# 运行时重新启用日志
sdk_base.get_config().set('enable_logging', True)
```

## 上下文管理

使用 `SdkContext` 进行全局 SDK 实例管理：

```python
from app.infrastructure.sdk.base import SdkBase, SdkContext

# 注册 SDK 实例
config = {'sdk_name': 'global_sdk', 'base_url': 'https://api.example.com'}
sdk_base = SdkBase(config)
SdkContext.register('my_global_sdk', sdk_base)

# 在其他地方获取
def some_other_function():
    sdk = SdkContext.get('my_global_sdk')
    # 使用 sdk...

# 检查是否存在
if SdkContext.has('my_global_sdk'):
    sdk = SdkContext.get('my_global_sdk')

# 移除并清理
SdkContext.remove('my_global_sdk')  # 会自动调用 close()

# 清理所有
SdkContext.clear()
```

## 业务 API 开发

### 基础 API 类

```python
from app.infrastructure.sdk.base import AbstractApi

class UserApi(AbstractApi):
    """用户相关 API"""

    def list_users(self, page=1, size=20):
        """获取用户列表"""
        params = {'page': page, 'size': size}
        response = self.request('GET', '/users', params=params)
        return response.json()

    def get_user(self, user_id):
        """获取单个用户"""
        response = self.request('GET', f'/users/{user_id}')
        return response.json()

    def create_user(self, user_data):
        """创建用户"""
        response = self.request('POST', '/users', data=user_data)
        return response.json()

    def update_user(self, user_id, user_data):
        """更新用户"""
        response = self.request('PUT', f'/users/{user_id}', data=user_data)
        return response.json()

# 使用示例
config = {'sdk_name': 'user_sdk', 'base_url': 'https://api.example.com'}
sdk_base = SdkBase(config)
user_api = UserApi(sdk_base)

# 调用 API
users = user_api.list_users(page=1, size=10)
user = user_api.get_user(123)
```

### 带认证的 API 类

```python
class AuthenticatedApi(AbstractApi):
    """需要认证的 API 基类"""

    def __init__(self, sdk_base, token):
        super().__init__(sdk_base)
        self.token = token

    def _get_auth_headers(self):
        """获取认证头"""
        return {'Authorization': f'Bearer {self.token}'}

    def request(self, method, url, data=None, **kwargs):
        """重写 request 方法添加认证头"""
        headers = kwargs.pop('headers', {})
        headers.update(self._get_auth_headers())
        return super().request(method, url, data=data, headers=headers, **kwargs)

class ProtectedUserApi(AuthenticatedApi):
    """需要认证的用户 API"""

    def get_profile(self):
        """获取用户资料"""
        response = self.request('GET', '/profile')
        return response.json()

# 使用示例
sdk_base = SdkBase(config)
protected_api = ProtectedUserApi(sdk_base, token='your-jwt-token')
profile = protected_api.get_profile()
```

### 异步 API 类

```python
class AsyncUserApi(AbstractApi):
    """异步用户 API"""

    async def get_user_async(self, user_id):
        """异步获取用户"""
        response = await self.async_request('GET', f'/users/{user_id}')
        return response.json()

    async def batch_get_users(self, user_ids):
        """批量获取用户"""
        tasks = [self.get_user_async(uid) for uid in user_ids]
        return await asyncio.gather(*tasks)

# 使用示例
async def main():
    sdk_base = SdkBase(config)
    api = AsyncUserApi(sdk_base)

    # 批量获取用户
    users = await api.batch_get_users([1, 2, 3, 4, 5])
    print(f"获取了 {len(users)} 个用户")

    sdk_base.close()
```

## 错误处理

```python
from app.infrastructure.sdk.base import SdkException, HttpRequestError

class MyApi(AbstractApi):
    def safe_get_user(self, user_id):
        try:
            response = self.request('GET', f'/users/{user_id}')
            return response.json()
        except HttpRequestError as e:
            if e.status_code == 404:
                return None  # 用户不存在
            elif e.status_code == 401:
                raise AuthenticationError("认证失败")
            else:
                raise  # 重新抛出其他 HTTP 错误
        except SdkException as e:
            # 处理其他 SDK 相关错误
            print(f"SDK 错误: {e}")
            return None

# 使用示例
api = MyApi(sdk_base)
user = api.safe_get_user(999)  # 可能返回 None
if user:
    print(f"用户名: {user['name']}")
else:
    print("用户不存在或请求失败")
```

## 实际案例：Magic Service SDK

```python
from app.infrastructure.sdk.base import SdkBase, AbstractApi

class MagicServiceApi(AbstractApi):
    """Magic Service API 封装"""

    def __init__(self, sdk_base, token):
        super().__init__(sdk_base)
        self.token = token

    def _get_headers(self):
        """获取 Magic Service 所需的请求头"""
        return {
            'token': self.token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    def request(self, method, url, data=None, **kwargs):
        """重写 request 添加认证头"""
        headers = kwargs.pop('headers', {})
        headers.update(self._get_headers())
        return super().request(method, url, data=data, headers=headers, **kwargs)

    def refresh_sts_token(self):
        """刷新 STS Token"""
        response = self.request('POST', '/api/v1/super-agent/file/refresh-sts-token')
        return response.json()

# 创建 Magic Service SDK
def create_magic_service_sdk(token):
    config = {
        'sdk_name': 'magic_service',
        'base_url': 'https://api.t.teamshare.cn/magic-service',
        'timeout': 30
    }

    sdk_base = SdkBase(config)
    return MagicServiceApi(sdk_base, token)

# 使用示例
magic_api = create_magic_service_sdk('*****')
result = magic_api.refresh_sts_token()
print("STS Token 刷新结果:", result)
```

## 测试

### 运行测试

```bash
# 运行所有 SDK base 测试
python -m pytest tests/infrastructure/sdk/ -v

# 运行特定测试
python -m pytest tests/infrastructure/sdk/test_base.py -v

# 运行 AgentLang Logger 集成测试
python -m pytest tests/infrastructure/sdk/test_agentlang_logger.py -v

# 运行真实 API 集成测试（需要网络连接）
python -m pytest tests/infrastructure/sdk/test_base.py::TestRealApiIntegration -v
```

### 编写测试

```python
import pytest
from unittest.mock import Mock, patch
from app.infrastructure.sdk.base import SdkBase, AbstractApi

class TestMyApi:
    @patch('httpx.Client')
    def test_my_api_get_user(self, mock_client_class):
        # 设置 mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'id': 123, 'name': 'Test User'}

        mock_client = Mock()
        mock_client.request.return_value = mock_response
        mock_client_class.return_value = mock_client

        # 测试
        config = {'sdk_name': 'test', 'base_url': 'https://api.test.com'}
        sdk_base = SdkBase(config)
        api = MyApi(sdk_base)

        result = api.get_user(123)

        # 验证
        assert result['id'] == 123
        assert result['name'] == 'Test User'
        mock_client.request.assert_called_once_with(
            'GET', '/users/123', json=None
        )

        sdk_base.close()
```

## 最佳实践

### 1. 资源管理
```python
# 推荐：使用上下文管理器
def with_sdk():
    config = {'sdk_name': 'temp_sdk', 'base_url': 'https://api.com'}
    sdk_base = SdkBase(config)
    try:
        api = MyApi(sdk_base)
        return api.get_data()
    finally:
        sdk_base.close()  # 确保资源释放
```

### 2. 配置管理
```python
# 推荐：从环境变量或配置文件读取
import os

def create_sdk_config():
    return {
        'sdk_name': 'production_sdk',
        'base_url': os.getenv('API_BASE_URL', 'https://api.example.com'),
        'timeout': int(os.getenv('API_TIMEOUT', '30')),
        'enable_logging': os.getenv('ENABLE_API_LOGGING', 'true').lower() == 'true'
    }
```

### 3. 错误处理
```python
# 推荐：统一的错误处理
class BaseApi(AbstractApi):
    def safe_request(self, method, url, **kwargs):
        try:
            return self.request(method, url, **kwargs)
        except HttpRequestError as e:
            # 记录错误并转换为业务异常
            logger = self.sdk_base.get_logger()
            if logger:
                logger.error(f"API 请求失败: {e}")
            raise BusinessException(f"API 调用失败: {e.status_code}")
```

### 4. 性能优化
```python
# 高并发场景：禁用日志
config = {
    'sdk_name': 'high_perf_sdk',
    'base_url': 'https://api.example.com',
    'enable_logging': False,  # 提升性能
    'timeout': 10  # 较短的超时时间
}

# 异步批量处理
async def process_batch(items):
    sdk_base = SdkBase(config)
    api = AsyncApi(sdk_base)

    try:
        tasks = [api.process_item(item) for item in items]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return results
    finally:
        sdk_base.close()
```

## 常见问题

### Q: 如何处理认证？
A: SDK Base 不处理认证逻辑。请在业务 API 类中重写 `request` 方法添加认证头。

### Q: 如何自定义请求头？
A: 在调用 `request` 或 `async_request` 时传入 `headers` 参数，或在业务 API 类中统一处理。

### Q: 支持重试机制吗？
A: SDK Base 本身不包含重试机制。可以在业务 API 类中使用装饰器或重写请求方法实现。

### Q: 如何处理不同的响应格式？
A: `request` 返回原始的 `httpx.Response` 对象，你可以调用 `.json()`、`.text` 或 `.content` 处理不同格式。

### Q: 可以配置连接池吗？
A: 目前使用 `httpx` 的默认连接池配置。如需自定义，可以继承 `SdkBase` 并重写 `get_client` 方法。

---

## 总结

SDK Base 提供了构建 HTTP 客户端的坚实基础，具有以下优势：

- 🚀 **简洁高效** - 最小化的设计，专注核心功能
- 🔧 **高度灵活** - 支持各种日志方案和配置选项
- 📦 **易于扩展** - 清晰的抽象接口，便于构建业务 SDK
- 🧪 **测试友好** - 完整的测试覆盖和 Mock 支持
- 🔄 **向后兼容** - 所有新特性都保持向后兼容

开始使用 SDK Base，让 HTTP 客户端开发变得更加简单！
