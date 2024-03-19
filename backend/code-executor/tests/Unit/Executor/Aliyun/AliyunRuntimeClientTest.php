<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Tests\Unit\Executor\Aliyun;

use AlibabaCloud\SDK\FC\V20230330\Models\InvokeFunctionResponse;
use Dtyq\CodeExecutor\Enums\StatusCode;
use Dtyq\CodeExecutor\Exception\ExecuteException;
use Dtyq\CodeExecutor\Exception\ExecuteFailedException;
use Dtyq\CodeExecutor\ExecutionRequest;
use Dtyq\CodeExecutor\ExecutionResult;
use Dtyq\CodeExecutor\Executor\Aliyun\AliyunRuntimeClient;
use Dtyq\CodeExecutor\Executor\Aliyun\FC;
use Dtyq\CodeExecutor\Language;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\StreamInterface;

/**
 * @internal
 * @covers \Dtyq\CodeExecutor\Executor\Aliyun\AliyunRuntimeClient
 */
class AliyunRuntimeClientTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    private $mockFcClient;

    private array $config;

    protected function setUp(): void
    {
        $this->mockFcClient = \Mockery::mock(FC::class);

        $this->config = [
            'access_key' => 'test_access_key',
            'secret_key' => 'test_secret_key',
            'region' => 'cn-test',
            'endpoint' => 'test.endpoint.com',
            'function' => [
                'name' => 'test-function-name',
                'cpu' => 0.25,
                'disk_size' => 512,
                'memory_size' => 512,
                'instance_concurrency' => 1,
                'runtime' => 'custom.debian10',
                'timeout' => 60,
            ],
        ];
    }

    public function testConstructorWithInvalidConfig(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new AliyunRuntimeClient([]);
    }

    public function testGetSupportedLanguages(): void
    {
        // 使用反射来初始化客户端但跳过initializeClient方法
        $clientReflection = new \ReflectionClass(AliyunRuntimeClient::class);
        $client = $clientReflection->newInstanceWithoutConstructor();

        $configProperty = $clientReflection->getProperty('config');
        $configProperty->setAccessible(true);
        $configProperty->setValue($client, $this->config);

        $fcClientProperty = $clientReflection->getProperty('fcClient');
        $fcClientProperty->setAccessible(true);
        $fcClientProperty->setValue($client, $this->mockFcClient);

        $supportLanguagesProperty = $clientReflection->getProperty('supportLanguages');
        $supportLanguagesProperty->setAccessible(true);
        $supportLanguagesProperty->setValue($client, [Language::PHP]);

        $this->assertEquals([Language::PHP], $client->getSupportedLanguages());
    }

    public function testInvoke(): void
    {
        // 创建符合 parseExecutionResult 函数预期的响应数据
        $responseBody = json_encode([
            'code' => StatusCode::OK->value,
            'data' => [
                'output' => 'test output',
                'duration' => 100,
                'result' => ['value' => 'test result'],
            ],
        ]);

        $mockedStream = \Mockery::mock(StreamInterface::class);
        $mockedStream->shouldReceive('__toString')
            ->andReturn($responseBody);

        $invokeFunctionResponse = new InvokeFunctionResponse([]);
        $invokeFunctionResponse->body = $mockedStream;
        $invokeFunctionResponse->statusCode = 200;

        // 准备请求参数
        $functionName = 'test-function-name';

        // Mock调用
        $this->mockFcClient->shouldReceive('invokeFunction')
            ->once()
            ->with($functionName, \Mockery::any())
            ->andReturn($invokeFunctionResponse);

        // 使用反射来创建客户端并注入Mock和配置
        $clientReflection = new \ReflectionClass(AliyunRuntimeClient::class);
        $client = $clientReflection->newInstanceWithoutConstructor();

        $configProperty = $clientReflection->getProperty('config');
        $configProperty->setAccessible(true);
        $configProperty->setValue($client, $this->config);

        $fcClientProperty = $clientReflection->getProperty('fcClient');
        $fcClientProperty->setAccessible(true);
        $fcClientProperty->setValue($client, $this->mockFcClient);

        $supportLanguagesProperty = $clientReflection->getProperty('supportLanguages');
        $supportLanguagesProperty->setAccessible(true);
        $supportLanguagesProperty->setValue($client, [Language::PHP]);

        // 创建执行请求
        $request = new ExecutionRequest(Language::PHP, '<?php echo "Hello World"; ?>');

        // 执行测试
        $result = $client->invoke($request);

        // 验证结果
        $this->assertInstanceOf(ExecutionResult::class, $result);
        $this->assertEquals('test output', $result->getOutput());
        $this->assertEquals(100, $result->getDuration());
        $this->assertEquals(['value' => 'test result'], $result->getResult());
    }

    public function testInvokeInvalidResponse(): void
    {
        // Mock ExecuteFailedException 的直接情况
        $mockedStream = \Mockery::mock(StreamInterface::class);
        $mockedStream->shouldReceive('__toString')
            ->andReturn('');  // 空响应会触发错误

        $invokeFunctionResponse = new InvokeFunctionResponse([]);
        $invokeFunctionResponse->body = $mockedStream;
        $invokeFunctionResponse->statusCode = 200;

        // 准备请求参数
        $functionName = 'test-function-name';

        // Mock调用
        $this->mockFcClient->shouldReceive('invokeFunction')
            ->once()
            ->with($functionName, \Mockery::any())
            ->andReturn($invokeFunctionResponse);

        // 使用反射来创建客户端并注入Mock和配置
        $clientReflection = new \ReflectionClass(AliyunRuntimeClient::class);
        $client = $clientReflection->newInstanceWithoutConstructor();

        $configProperty = $clientReflection->getProperty('config');
        $configProperty->setAccessible(true);
        $configProperty->setValue($client, $this->config);

        $fcClientProperty = $clientReflection->getProperty('fcClient');
        $fcClientProperty->setAccessible(true);
        $fcClientProperty->setValue($client, $this->mockFcClient);

        $supportLanguagesProperty = $clientReflection->getProperty('supportLanguages');
        $supportLanguagesProperty->setAccessible(true);
        $supportLanguagesProperty->setValue($client, [Language::PHP]);

        // 创建执行请求
        $request = new ExecutionRequest(Language::PHP, '<?php echo "Hello World"; ?>');

        $this->expectException(ExecuteFailedException::class);
        // 调整异常消息匹配，使用更宽松的模式
        $this->expectExceptionMessageMatches('/Failed to retrieve the result/');

        // 执行测试
        $client->invoke($request);
    }

    public function testInvokeInvalidResponseCode(): void
    {
        // 创建状态码不是 OK 的响应
        $responseBody = json_encode([
            'code' => StatusCode::ERROR->value,
            'message' => 'An error occurred in function execution',
        ]);

        $mockedStream = \Mockery::mock(StreamInterface::class);
        $mockedStream->shouldReceive('__toString')
            ->andReturn($responseBody);

        $invokeFunctionResponse = new InvokeFunctionResponse([]);
        $invokeFunctionResponse->body = $mockedStream;
        $invokeFunctionResponse->statusCode = 200;

        // 准备请求参数
        $functionName = 'test-function-name';

        // Mock调用
        $this->mockFcClient->shouldReceive('invokeFunction')
            ->once()
            ->with($functionName, \Mockery::any())
            ->andReturn($invokeFunctionResponse);

        // 使用反射来创建客户端并注入Mock和配置
        $clientReflection = new \ReflectionClass(AliyunRuntimeClient::class);
        $client = $clientReflection->newInstanceWithoutConstructor();

        $configProperty = $clientReflection->getProperty('config');
        $configProperty->setAccessible(true);
        $configProperty->setValue($client, $this->config);

        $fcClientProperty = $clientReflection->getProperty('fcClient');
        $fcClientProperty->setAccessible(true);
        $fcClientProperty->setValue($client, $this->mockFcClient);

        $supportLanguagesProperty = $clientReflection->getProperty('supportLanguages');
        $supportLanguagesProperty->setAccessible(true);
        $supportLanguagesProperty->setValue($client, [Language::PHP]);

        // 创建执行请求
        $request = new ExecutionRequest(Language::PHP, '<?php echo "Hello World"; ?>');

        // 根据 parseExecutionResult 函数的实现，非 OK 状态码会抛出 ExecuteException 异常
        $this->expectException(ExecuteException::class);
        $this->expectExceptionMessage('An error occurred in function execution');

        // 执行测试
        $client->invoke($request);
    }
}
