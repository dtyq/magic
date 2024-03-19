<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Tests\Unit\Executor\Aliyun;

use Dtyq\CodeExecutor\Exception\ExecuteFailedException;
use Dtyq\CodeExecutor\Exception\InvalidArgumentException;
use Dtyq\CodeExecutor\ExecutionRequest;
use Dtyq\CodeExecutor\ExecutionResult;
use Dtyq\CodeExecutor\Executor\Aliyun\AliyunExecutor;
use Dtyq\CodeExecutor\Executor\Aliyun\AliyunRuntimeClient;
use Dtyq\CodeExecutor\Language;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Mockery\MockInterface;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @covers \Dtyq\CodeExecutor\Executor\Aliyun\AliyunExecutor
 */
class AliyunExecutorTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    /**
     * @var AliyunRuntimeClient|MockInterface
     */
    private $mockRuntimeClient;

    /**
     * @var AliyunExecutor
     */
    private $executor;

    protected function setUp(): void
    {
        $this->mockRuntimeClient = \Mockery::mock(AliyunRuntimeClient::class);
        $this->executor = new AliyunExecutor($this->mockRuntimeClient);
    }

    public function testExecute(): void
    {
        // 准备测试数据
        $request = new ExecutionRequest(Language::PHP, '<?php echo "test"; ?>');
        $expectedResult = new ExecutionResult('test output', 100, ['value' => 'result']);

        // 设置Mock的期望行为
        $this->mockRuntimeClient->shouldReceive('getSupportedLanguages')
            ->once()
            ->andReturn([Language::PHP]);

        $this->mockRuntimeClient->shouldReceive('invoke')
            ->once()
            ->with($request)
            ->andReturn($expectedResult);

        // 执行测试方法
        $result = $this->executor->execute($request);

        // 验证结果
        $this->assertSame($expectedResult, $result);
    }

    public function testExecuteUnsupportedLanguage(): void
    {
        // 准备测试数据
        $request = new ExecutionRequest(Language::PYTHON, 'print("test")');

        // 设置Mock的期望行为
        $this->mockRuntimeClient->shouldReceive('getSupportedLanguages')
            ->once()
            ->andReturn([Language::PHP]);

        // 期望抛出异常
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Language python is not supported by this executor');

        // 执行测试方法
        $this->executor->execute($request);
    }

    public function testExecuteRuntimeException(): void
    {
        // 准备测试数据
        $request = new ExecutionRequest(Language::PHP, '<?php echo "test"; ?>');
        $exception = new \RuntimeException('Runtime error', 500);

        // 设置Mock的期望行为
        $this->mockRuntimeClient->shouldReceive('getSupportedLanguages')
            ->once()
            ->andReturn([Language::PHP]);

        $this->mockRuntimeClient->shouldReceive('invoke')
            ->once()
            ->with($request)
            ->andThrow($exception);

        // 期望抛出异常
        $this->expectException(ExecuteFailedException::class);
        $this->expectExceptionMessage('Failed to execute code: Runtime error');

        // 执行测试方法
        $this->executor->execute($request);
    }

    public function testExecuteExecutionException(): void
    {
        // 准备测试数据
        $request = new ExecutionRequest(Language::PHP, '<?php echo "test"; ?>');
        $exception = new ExecuteFailedException('Execution error', 400);

        // 设置Mock的期望行为
        $this->mockRuntimeClient->shouldReceive('getSupportedLanguages')
            ->once()
            ->andReturn([Language::PHP]);

        $this->mockRuntimeClient->shouldReceive('invoke')
            ->once()
            ->with($request)
            ->andThrow($exception);

        // 期望抛出原始异常
        $this->expectException(ExecuteFailedException::class);
        $this->expectExceptionCode(400);
        $this->expectExceptionMessage('Execution error');

        // 执行测试方法
        $this->executor->execute($request);
    }

    public function testGetSupportedLanguages(): void
    {
        // 设置Mock的期望行为
        $this->mockRuntimeClient->shouldReceive('getSupportedLanguages')
            ->once()
            ->andReturn([Language::PHP]);

        // 执行测试方法
        $languages = $this->executor->getSupportedLanguages();

        // 验证结果
        $this->assertEquals([Language::PHP], $languages);
    }

    public function testInitialize(): void
    {
        // 设置Mock的期望行为
        $this->mockRuntimeClient->shouldReceive('initialize')
            ->once();

        // 执行测试方法
        $this->executor->initialize();
    }
}
