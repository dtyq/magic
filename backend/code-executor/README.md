# 代码执行器 (Code Executor)

一个支持多语言代码执行的隔离环境系统，可通过不同的运行时环境（如阿里云函数计算、本地进程等）安全地执行代码。

## 主要特性

- **多语言支持**：目前支持PHP、Python等编程语言
- **多运行时环境**：支持阿里云函数计算等运行时
- **安全隔离**：在独立环境中执行代码，确保系统安全性
- **高扩展性**：易于添加新的语言支持和运行时环境
- **简洁API**：简单直观的接口设计

## 安装

通过Composer安装：

```bash
composer require dtyq/code-executor
```

## 快速开始

### 直接使用

```php
<?php

use Dtyq\CodeExecutor\Executor\Aliyun\AliyunExecutor;
use Dtyq\CodeExecutor\Executor\Aliyun\AliyunRuntimeClient;
use Dtyq\CodeExecutor\ExecutionRequest;
use Dtyq\CodeExecutor\Language;

// 阿里云配置
$config = [
    'access_key' => 'your-access-key-id',
    'secret_key' => 'your-access-key-secret',
    'region' => 'cn-hangzhou',
    'endpoint' => 'cn-hangzhou.fc.aliyuncs.com',
];

// 创建阿里云运行时客户端
$runtimeClient = new AliyunRuntimeClient($config);

// 创建执行器
$executor = new AliyunExecutor($runtimeClient);

// 初始化执行环境
$executor->initialize();

// 创建执行请求
$request = new ExecutionRequest(
    Language::PHP,
    '<?php 
        $a = 10;
        $b = 20;
        $sum = $a + $b;
        echo "计算结果: {$a} + {$b} = {$sum}";
        return ["sum" => $sum, "a" => $a, "b" => $b];
    ',
    [],  // 参数
    30   // 超时时间（秒）
);

// 执行代码
$result = $executor->execute($request);

// 输出结果
echo "输出: " . $result->getOutput() . PHP_EOL;
echo "执行时间: " . $result->getDuration() . "ms" . PHP_EOL;
echo "返回结果: " . json_encode($result->getResult(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
```

### 在 Hyperf 中使用

发布配置文件:

```bash
php bin/hyperf.php vendor:publish dtyq/code-executor
```

在 `.env` 文件中新增环境变量:

```
CODE_EXECUTOR=aliyun
CODE_EXECUTOR_ALIYUN_ACCESS_KEY=
CODE_EXECUTOR_ALIYUN_SECRET_KEY=
CODE_EXECUTOR_ALIYUN_REGION=cn-shenzhen
CODE_EXECUTOR_ALIYUN_ENDPOINT=
CODE_EXECUTOR_ALIYUN_FUNCTION_NAME=
```

## 详细文档

### 核心组件

- **执行器(Executor)**：负责代码执行的主要组件
- **运行时客户端(RuntimeClient)**：与具体执行环境通信的接口
- **执行请求(ExecutionRequest)**：封装代码执行的请求信息
- **执行结果(ExecutionResult)**：封装代码执行的结果信息

### 支持的语言

目前支持的编程语言：

- PHP
- Python

可通过扩展轻松添加更多语言支持。

### 支持的运行时环境

目前支持的运行时环境：

- 阿里云函数计算

### 配置选项

#### 阿里云函数计算配置

```php
$config = [
    'access_key' => 'your-access-key-id',    // 阿里云AccessKey ID
    'secret_key' => 'your-access-key-secret', // 阿里云AccessKey Secret
    'region' => 'cn-hangzhou',               // 地域ID
    'endpoint' => 'cn-hangzhou.fc.aliyuncs.com', // 服务接入点
    'function' => [
        'name' => 'test-code-runner',       // 函数名称
        // 您可以在这里覆盖默认配置
        'code_package_path' => __DIR__ . '/../runner',
    ],
];
```

## 示例

更多使用示例可在`examples`目录中找到：

- `examples/aliyun_executor_example.php` - 阿里云函数计算执行器的完整示例
- `examples/aliyun_executor_config.example.php` - 配置示例文件

运行示例：

```bash
# 复制配置示例
cp examples/aliyun_executor_config.example.php examples/aliyun_executor_config.php

# 编辑配置文件
vim examples/aliyun_executor_config.php

# 运行示例
php examples/aliyun_executor_example.php
```

## 扩展开发

### 添加新的语言支持

1. 在`Language`枚举中添加新的语言类型
2. 在运行时客户端中实现对应的语言支持逻辑

### 添加新的运行时环境

1. 实现`RuntimeClient`接口
2. 创建对应的`Executor`实现类

## 注意事项

1. 使用阿里云函数计算服务需要有有效的阿里云账号和正确的配置
2. 代码执行可能产生费用，请注意控制资源使用
3. 建议先在测试环境中验证后再用于生产环境
4. `runner` 目录包含 `dtyq/code-runner-bwrap` 项目的源代码，该组件作为阿里云函数计算服务中的运行时环境。由于该组件尚未正式开源，目前直接内嵌在本项目中以确保功能完整性。待该组件正式开源后，仅需保留 `runner/bootstrap` 文件，其余部分可通过依赖方式引入

## 许可证

Apache License 2.0
