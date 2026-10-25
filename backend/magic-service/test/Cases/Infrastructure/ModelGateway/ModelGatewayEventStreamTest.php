<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ModelGateway;

use App\Infrastructure\ModelGateway\ModelGatewayEventStream;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use HyperfTest\Support\ModelGateway\RecordingWritable;
use LogicException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Swow\SocketException;

/** 验证仅在下游写入边界隔离传输故障。
 * @internal
 */
class ModelGatewayEventStreamTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    /** 保存测试前容器。 */
    protected function setUp(): void
    {
        if (ApplicationContext::hasContainer()) {
            $this->previousContainer = ApplicationContext::getContainer();
        }
    }

    /** 恢复测试前容器，避免污染后续用例。 */
    protected function tearDown(): void
    {
        if ($this->previousContainer) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    /** 正常输出保持内容且幂等结束，结束后追加仍是逻辑错误。 */
    public function testNormalWriteAndIdempotentEnd(): void
    {
        $writer = new RecordingWritable();
        $stream = new ModelGatewayEventStream($writer);
        $stream->write('mock');
        $stream->end();
        $stream->end();
        $stream->close();
        self::assertSame(['mock'], $writer->writes);
        self::assertSame(1, $writer->endAttempts);
        $this->expectException(LogicException::class);
        $stream->write('late');
    }

    /** 各阶段传输失败只记录一次脱敏日志，之后不触碰下游。 */
    public function testTransportFailuresDetachOnlyOnce(): void
    {
        foreach (['headers', 'write_false', 'write_exception', 'end_false', 'end_exception'] as $phase) {
            $logger = $this->createMock(LoggerInterface::class);
            $logger->expects(self::once())->method('warning')->with(self::anything(), self::callback(static function (array $context): bool {
                return $context['downstream_writable'] === false
                    && ! isset($context['message']) && ! isset($context['trace']);
            }));
            $factory = $this->createMock(LoggerFactory::class);
            $factory->method('get')->willReturn($logger);
            $container = $this->createMock(ContainerInterface::class);
            $container->method('get')->willReturn($factory);
            ApplicationContext::setContainer($container);
            $writer = new RecordingWritable();
            $writer->failHeaders = $phase === 'headers';
            $writer->failWriteAt = str_starts_with($phase, 'write') ? 1 : null;
            $writer->failEnd = str_starts_with($phase, 'end');
            $writer->error = str_ends_with($phase, 'exception') ? new SocketException('mock secret') : null;
            $stream = new ModelGatewayEventStream($writer);
            $stream->write('mock');
            $stream->end();
            $attempts = [$writer->headerAttempts, $writer->writeAttempts, $writer->endAttempts];
            $stream->write('discarded');
            $stream->end();
            $stream->close();
            self::assertSame($attempts, [$writer->headerAttempts, $writer->writeAttempts, $writer->endAttempts], $phase);
        }
    }

    /** 普通程序异常不能被当作网络断连吞掉。 */
    public function testLogicFailureStillPropagates(): void
    {
        $writer = new RecordingWritable();
        $writer->failWriteAt = 1;
        $writer->error = new RuntimeException('mock logic');
        $stream = new ModelGatewayEventStream($writer);
        $this->expectExceptionObject($writer->error);
        $stream->write('mock');
    }

    /** 日志设施抛错也不能阻断消费端。 */
    public function testLoggingFailureDoesNotEscape(): void
    {
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willThrowException(new RuntimeException('mock logger unavailable'));
        ApplicationContext::setContainer($container);
        $writer = new RecordingWritable();
        $writer->failWriteAt = 1;
        $stream = new ModelGatewayEventStream($writer);
        $stream->write('mock')->write('discarded');
        $stream->end();
        self::assertSame(1, $writer->writeAttempts);
        self::assertSame(0, $writer->endAttempts);
    }
}
