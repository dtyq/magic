# 存储模块使用说明

这个模块提供了统一的文件存储接口，支持多个存储平台（目前支持火山引擎 TOS，计划支持阿里云 OSS）。

## 快速开始

```python
from app.infrastructure.storage import StorageFactory, PlatformType, VolcEngineCredentials

# 1. 准备存储凭证
credentials = VolcEngineCredentials(
    policy="your_policy",
    host="your_host",
    algorithm="TOS4-HMAC-SHA256",
    date="your_date",
    credential="your_credential",
    signature="your_signature",
    server_side_encryption="AES256",
    dir="your_dir",
    content_type="",
    callback="",
    expires=1743187877
)

# 2. 获取存储实例
storage = StorageFactory.get_storage(PlatformType.tos)

# 3. 上传文件
# 3.1 上传字符串内容
content = "Hello, World!".encode('utf-8')
result = storage.upload(
    file=content,
    key="test.txt",
    credentials=credentials,
    options={
        "progress": lambda p: print(f"上传进度: {p:.2f}%"),
        "headers": {
            "Cache-Control": "max-age=31536000"
        }
    }
)

# 3.2 上传本地文件
result = storage.upload(
    file="path/to/your/file.txt",
    key="remote_file.txt",
    credentials=credentials
)
```

## 支持的存储平台

- `PlatformType.tos`: 火山引擎对象存储
- `PlatformType.aliyun`: 阿里云对象存储（计划支持）

## 主要特性

- 统一的存储接口
- 支持多种文件类型（字符串、字节流、本地文件）
- 上传进度回调
- 自定义 HTTP 头
- 服务器端加密
- 单例模式确保资源有效利用

## 注意事项

1. 上传大小限制：单个文件最大支持 5GB
2. 凭证有效期：请确保上传凭证在有效期内
3. 文件路径：上传时的 key 会自动与凭证中的 dir 组合
4. 临时文件：使用本地文件上传后，记得及时清理

## 错误处理

```python
try:
    result = storage.upload(file=content, key="test.txt", credentials=credentials)
except InitException as e:
    print("初始化错误:", e)
except UploadException as e:
    print("上传错误:", e)
except ValueError as e:
    print("参数错误:", e)
```

更多示例请参考 `examples/volcengine_upload_example.py`。 