<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */
// 加载自动加载器
require_once __DIR__ . '/../vendor/autoload.php';

use Dtyq\CodeExecutor\Exception\ExecuteException;
use Dtyq\CodeExecutor\ExecutionRequest;
use Dtyq\CodeExecutor\Executor\Aliyun\AliyunExecutor;
use Dtyq\CodeExecutor\Executor\Aliyun\AliyunRuntimeClient;
use Dtyq\CodeExecutor\Language;

// 检查配置文件是否存在
$configFile = __DIR__ . '/aliyun_executor_config.php';
if (! file_exists($configFile)) {
    echo "配置文件不存在，请根据aliyun_executor_config.example.php创建aliyun_executor_config.php文件并填入您的阿里云配置\n";
    exit(1);
}

// 加载配置
$config = require $configFile;

try {
    echo "=== 阿里云代码执行器示例 ===\n\n";

    // 创建运行时客户端
    echo "正在创建运行时客户端...\n";
    $runtimeClient = new AliyunRuntimeClient($config);

    // 创建执行器
    echo "正在创建执行器...\n";
    $executor = new AliyunExecutor($runtimeClient);

    // 初始化执行器（准备运行时环境）
    echo "正在初始化执行环境...\n";
    $executor->initialize();
    echo "执行环境初始化完成\n\n";

    // 准备要执行的PHP代码
    $phpCode = <<<'EOD'
<?php
function add($a, $b) {
    return $a + $b;
}

$a = $args['a'] ?? 5;
$b = $args['b'] ?? 3;

$result = add($a, $b);

echo "计算结果: $a + $b = $result\n";

return [
    'sum' => $result,
    'a' => $a,
    'b' => $b,
    'timestamp' => time()
];
EOD;

    // 创建执行请求，可以传入参数
    $request = new ExecutionRequest(
        Language::PHP,       // 执行语言
        $phpCode,            // 要执行的代码
        ['a' => 10, 'b' => 7], // 传递给代码的参数
        60                   // 超时秒数
    );

    // 执行代码
    echo "正在执行代码...\n";
    echo json_encode($request, JSON_PRETTY_PRINT);
    $startTime = microtime(true);
    $result = $executor->execute($request);
    $endTime = microtime(true);

    // 输出结果
    echo "\n执行完成!\n";
    echo "------------------------------\n";
    echo "执行输出:\n{$result->getOutput()}\n";
    echo "执行耗时: {$result->getDuration()}ms\n";
    echo '实际耗时: ' . round(($endTime - $startTime) * 1000, 2) . "ms\n";
    echo '输出内容: ' . $result->getOutput() . "\n";
    echo "执行结果:\n" . json_encode($result->getResult(), JSON_PRETTY_PRINT) . "\n";
    echo "------------------------------\n";

    // 多次执行性能测试（可选）
    echo "\n是否进行性能测试? (y/n): ";
    $input = trim(fgets(STDIN));
    if (strtolower($input) === 'y') {
        $count = 10; // 执行次数
        echo "\n执行 {$count} 次性能测试...\n";

        $totalTime = 0;
        for ($i = 1; $i <= $count; ++$i) {
            $startTime = microtime(true);
            $executor->execute($request);
            $endTime = microtime(true);
            $time = ($endTime - $startTime) * 1000;
            $totalTime += $time;
            echo "第 {$i} 次执行耗时: " . round($time, 2) . "ms\n";
            sleep(1);
        }

        echo "\n{$count} 次执行平均耗时: " . round($totalTime / $count, 2) . "ms\n";
    }
} catch (ExecuteException $e) {
    echo "\n执行错误: ({$e->getCode()}) {$e->getMessage()}\n";
    if (method_exists($e, 'getOutput')) {
        echo "错误输出: {$e->getOutput()}\n";
    }
} catch (Exception $e) {
    echo "\n系统错误: ({$e->getCode()}) {$e->getMessage()}\n";
}

echo "\n=== 示例运行结束 ===\n";
