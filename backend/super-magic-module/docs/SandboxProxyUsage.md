# 沙箱代理服务使用指南

## 概述

我们提供了一个通用的沙箱代理功能，可以自动处理沙箱的检查、创建和请求代理。这个功能封装在 `SandboxGatewayInterface::ensureSandboxAndProxy()` 方法中。

## 核心功能

### `ensureSandboxAndProxy` 方法

这个方法会自动：
1. 检查沙箱是否存在
2. 如果沙箱不存在或状态不可用，自动创建新沙箱
3. 将请求代理到沙箱
4. 返回结果，包含实际使用的沙箱ID

### 方法签名

```php
public function ensureSandboxAndProxy(
    string $sandboxId,      // 沙箱ID（可以为空，会自动生成）
    string $method,         // HTTP方法 (GET, POST, PUT, DELETE等)
    string $path,           // 目标路径
    array $data = [],       // 请求数据
    array $headers = []     // 额外的请求头
): GatewayResult;
```

## 使用示例

### 1. PDF转换服务

```php
class PdfConverterService extends AbstractSandboxOS implements PdfConverterInterface
{
    public function convert(string $sandboxId, PdfConverterRequest $request): PdfConverterResponse
    {
        try {
            // 使用 ensureSandboxAndProxy 自动处理沙箱检查和创建
            $result = $this->gateway->ensureSandboxAndProxy(
                $sandboxId,
                'POST',
                'api/pdf/convert-urls',
                $request->toArray()
            );

            $response = PdfConverterResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                // 获取实际使用的沙箱ID
                $actualSandboxId = $result->getDataValue('actual_sandbox_id') ?? $sandboxId;
                $this->logger->info('Conversion successful', [
                    'original_sandbox_id' => $sandboxId,
                    'actual_sandbox_id' => $actualSandboxId,
                ]);
            }

            return $response;
        } catch (Exception $e) {
            // 错误处理
            return PdfConverterResponse::fromApiResponse([
                'code' => -1,
                'message' => 'Error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }
}
```

### 2. 文件处理服务示例

```php
class FileProcessorService extends AbstractSandboxOS
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private SandboxGatewayInterface $gateway
    ) {
        parent::__construct($loggerFactory);
    }

    public function processFile(string $sandboxId, array $fileData): array
    {
        try {
            // 自动确保沙箱可用并发送请求
            $result = $this->gateway->ensureSandboxAndProxy(
                $sandboxId,
                'POST',
                'api/files/process',
                $fileData
            );

            if ($result->isSuccess()) {
                $actualSandboxId = $result->getDataValue('actual_sandbox_id') ?? $sandboxId;
                
                return [
                    'success' => true,
                    'sandbox_id' => $actualSandboxId,
                    'result' => $result->getData(),
                ];
            } else {
                return [
                    'success' => false,
                    'error' => $result->getMessage(),
                ];
            }
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
```

### 3. 数据分析服务示例

```php
class DataAnalysisService extends AbstractSandboxOS
{
    public function analyze(string $sandboxId, array $analysisRequest): AnalysisResult
    {
        try {
            $result = $this->gateway->ensureSandboxAndProxy(
                $sandboxId,
                'POST',
                'api/analysis/run',
                $analysisRequest
            );

            return AnalysisResult::fromGatewayResult($result);
        } catch (Exception $e) {
            return AnalysisResult::error($e->getMessage());
        }
    }

    public function getAnalysisStatus(string $sandboxId, string $analysisId): AnalysisResult
    {
        try {
            $result = $this->gateway->ensureSandboxAndProxy(
                $sandboxId,
                'GET',
                "api/analysis/{$analysisId}/status",
                []
            );

            return AnalysisResult::fromGatewayResult($result);
        } catch (Exception $e) {
            return AnalysisResult::error($e->getMessage());
        }
    }
}
```

## 优势

### 1. 自动沙箱管理
- 无需手动检查沙箱状态
- 自动创建不存在的沙箱
- 处理沙箱状态异常情况

### 2. 统一的错误处理
- 统一的日志记录
- 标准化的错误响应
- 自动重试机制

### 3. 简化的代码
- 减少重复的沙箱检查逻辑
- 统一的代理接口
- 更清晰的业务逻辑

## 迁移指南

### 从 `proxySandboxRequest` 迁移

**之前:**
```php
// 需要手动检查和创建沙箱
$statusResult = $this->gateway->getSandboxStatus($sandboxId);
if (!$statusResult->isSuccess() || !SandboxStatus::isAvailable($statusResult->getStatus())) {
    $createResult = $this->gateway->createSandbox(['sandbox_id' => $sandboxId]);
    if (!$createResult->isSuccess()) {
        throw new Exception('Failed to create sandbox');
    }
    $sandboxId = $createResult->getDataValue('sandbox_id');
}

$result = $this->gateway->proxySandboxRequest($sandboxId, 'POST', 'api/service', $data);
```

**现在:**
```php
// 自动处理沙箱检查和创建
$result = $this->gateway->ensureSandboxAndProxy($sandboxId, 'POST', 'api/service', $data);
$actualSandboxId = $result->getDataValue('actual_sandbox_id') ?? $sandboxId;
```

## 注意事项

1. **沙箱ID**: 如果传入空的沙箱ID，系统会自动生成一个新的沙箱ID
2. **实际沙箱ID**: 总是检查返回结果中的 `actual_sandbox_id` 字段，这是实际使用的沙箱ID
3. **错误处理**: 确保正确处理返回的错误信息
4. **日志记录**: 系统会自动记录沙箱操作的详细日志

## 配置

确保在依赖注入配置中正确注册 `SandboxGatewayInterface`:

```php
// config/autoload/dependencies.php
return [
    SandboxGatewayInterface::class => SandboxGatewayService::class,
];
``` 