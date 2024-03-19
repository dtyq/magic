# FileService 测试文档

这个目录包含了 `FileService` 的完整测试套件，包括 Mock 测试和真实集成测试。

## 测试文件说明

### 📋 test_file_service_mock.py
**Mock 单元测试** - 使用 Mock 对象测试核心逻辑，不需要真实的存储配置。

**特性：**
- ✅ 不依赖外部服务
- ✅ 运行速度快
- ✅ 测试覆盖率高
- ✅ 隔离性好

**测试内容：**
- FileService 初始化和缓存机制
- 存储服务创建和配置
- 文件上传逻辑（带凭证刷新）
- 下载链接生成
- 错误处理

### 🌐 test_file_service_real.py
**真实集成测试** - 使用真实的存储服务进行端到端测试。

**特性：**
- ⚡ 需要真实的存储配置
- ⚡ 测试完整的数据流
- ⚡ 验证凭证刷新机制
- ⚡ 检查实际的文件上传和下载

**测试内容：**
- 真实文件上传到存储服务
- 凭证自动刷新验证
- 下载链接生成和验证
- 多种文件类型支持
- 完整的错误处理

## 运行测试

### 🚀 运行所有 Mock 测试（推荐开始）
```bash
# 运行所有 Mock 测试
pytest tests/service/test_file_service_mock.py -v

# 运行特定测试
pytest tests/service/test_file_service_mock.py::TestFileServiceMock::test_file_service_initialization -v
```

### 🔧 配置真实集成测试

真实集成测试需要以下配置：

1. **启用测试**
   ```bash
   export TEST_FILE_SERVICE_REAL_ENABLED=true
   ```

2. **确保存储配置可用**
   - 确保 `MagicServiceConfigLoader` 能正确加载存储配置
   - 配置中需要包含 `upload_config`
   - 推荐使用本地存储进行测试以避免外部依赖

3. **运行真实测试**
   ```bash
   # 检查配置是否正确
   python tests/service/test_file_service_real.py

   # 运行所有真实测试
   pytest tests/service/test_file_service_real.py -v

   # 运行基础测试（不需要存储配置）
   pytest tests/service/test_file_service_real.py::TestFileServiceBasic -v
   ```

### 📊 运行完整测试套件
```bash
# 运行所有 service 测试
pytest tests/service/ -v

# 生成测试覆盖率报告
pytest tests/service/ --cov=app.service.file_service --cov-report=html

# 运行指定标记的测试
pytest tests/service/ -m "not slow" -v  # 跳过慢测试
```

## 测试配置选项

### 环境变量
| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `TEST_FILE_SERVICE_REAL_ENABLED` | `false` | 启用真实集成测试 |
| `STORAGE_PLATFORM` | `tos` | 存储平台类型 |

### 存储配置示例
真实测试需要以下配置结构：
```json
{
  "upload_config": {
    "platform": "local",
    "dir": "/tmp/test-storage/",
    "expires": 3600
  },
  "sts_token_refresh_config": {
    "url": "https://test.example.com/sts",
    "method": "POST",
    "headers": {"Content-Type": "application/json"}
  },
  "metadata": {
    "project": "fileservice-test"
  }
}
```

## 测试数据和清理

### 📁 测试文件
- 测试会创建临时文件进行上传
- 支持文本、二进制、JSON 等多种文件类型
- 所有临时文件在测试完成后自动清理

### 🧹 存储清理
- 真实测试上传的文件不会自动清理
- 建议使用本地存储进行测试
- 或者定期清理测试存储空间

## 故障排除

### ❌ 常见问题

**1. 真实测试被跳过**
```
SKIPPED [1] FileService 真实集成测试未启用
```
**解决：** 设置环境变量 `TEST_FILE_SERVICE_REAL_ENABLED=true`

**2. 存储配置不可用**
```
ValueError: Cannot load storage credentials
```
**解决：** 检查 `MagicServiceConfigLoader` 配置或使用本地存储

**3. 凭证刷新失败**
```
ConfigurationError: STS refresh config is not available
```
**解决：** 确保 `sts_token_refresh_config` 正确配置

**4. 网络连接问题**
```
ConnectionError: Could not connect to storage service
```
**解决：** 检查网络连接或切换到本地存储测试

### 🔍 调试技巧

1. **启用详细日志**
   ```bash
   pytest tests/service/ -v -s --log-cli-level=DEBUG
   ```

2. **运行单个测试**
   ```bash
   pytest tests/service/test_file_service_real.py::TestFileServiceReal::test_upload_runtime_file_text -v -s
   ```

3. **检查配置状态**
   ```python
   python -c "
   from app.infrastructure.magic_service import MagicServiceConfigLoader
   try:
       data = MagicServiceConfigLoader.load_config_data()
       print('配置可用:', 'upload_config' in data)
   except Exception as e:
       print('配置错误:', e)
   "
   ```

## 持续集成

建议在 CI/CD 流水线中：
- ✅ 始终运行 Mock 测试
- ⚡ 仅在特定环境运行真实测试
- 📊 生成测试覆盖率报告
- 🔔 真实测试失败时发送通知

### GitHub Actions 示例
```yaml
- name: Run FileService Tests
  run: |
    # 运行 Mock 测试
    pytest tests/service/test_file_service_mock.py -v

    # 在测试环境运行真实测试
    if [ "${{ env.ENVIRONMENT }}" == "test" ]; then
      export TEST_FILE_SERVICE_REAL_ENABLED=true
      pytest tests/service/test_file_service_real.py -v
    fi
```

## 参考

- [FileService 源码](../../app/service/file_service.py)
- [存储服务文档](../../app/infrastructure/storage/README.md)
- [pytest 文档](https://docs.pytest.org/)
- [Mock 对象使用指南](https://docs.python.org/3/library/unittest.mock.html)
