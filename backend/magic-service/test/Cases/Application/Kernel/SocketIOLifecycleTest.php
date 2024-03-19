<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Infrastructure\Core\ClassMap\SocketIoServer\Contract\SidLifecycleProviderInterface;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\SocketIOServer\Parser\Decoder;
use Hyperf\SocketIOServer\Parser\Encoder;
use Hyperf\SocketIOServer\SidProvider\DistributedSidProvider;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\SocketIOServer\SocketIO;
use Hyperf\SocketIOServer\SocketIOConfig;
use Hyperf\WebSocketServer\Sender;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use RuntimeException;

/**
 * @internal
 */
class SocketIOLifecycleTest extends TestCase
{
    public function testAssignSidForOpenUsesLifecycleProvider(): void
    {
        $provider = new LifecycleSidProvider('sid-test-server#100');
        $socketIO = $this->makeSocketIO($provider);

        $method = new ReflectionMethod(SocketIO::class, 'assignSidForOpen');
        $method->setAccessible(true);
        $sid = $method->invoke($socketIO, 10);

        $this->assertSame('sid-test-server#100', $sid);
        $this->assertSame(1, $provider->registerCalls);
        $this->assertSame(0, $provider->getSidCalls);
    }

    public function testAssignSidForOpenThrowsWhenSidIsEmpty(): void
    {
        $provider = new PlainSidProvider('');
        $socketIO = $this->makeSocketIO($provider);

        $method = new ReflectionMethod(SocketIO::class, 'assignSidForOpen');
        $method->setAccessible(true);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('sid assign failed for fd 10');
        $method->invoke($socketIO, 10);
    }

    public function testUnregisterSidForCloseCallsLifecycleProvider(): void
    {
        $provider = new LifecycleSidProvider('sid-test-server#200');
        $socketIO = $this->makeSocketIO($provider);

        $method = new ReflectionMethod(SocketIO::class, 'unregisterSidForClose');
        $method->setAccessible(true);
        $method->invoke($socketIO, 12);

        $this->assertSame(1, $provider->unregisterCalls);
        $this->assertSame(12, $provider->lastUnregisterFd);
    }

    public function testRollbackSidAfterOpenFailureCallsUnregister(): void
    {
        $provider = new LifecycleSidProvider('sid-test-server#300');
        $socketIO = $this->makeSocketIO($provider);

        $method = new ReflectionMethod(SocketIO::class, 'rollbackSidAfterOpenFailure');
        $method->setAccessible(true);
        $method->invoke($socketIO, 21);

        $this->assertSame(1, $provider->unregisterCalls);
        $this->assertSame(21, $provider->lastUnregisterFd);
    }

    public function testRollbackSidAfterOpenFailureLogsWhenUnregisterThrows(): void
    {
        $provider = new FailingLifecycleSidProvider('sid-test-server#301');
        $logger = $this->createMock(StdoutLoggerInterface::class);
        $logger->expects($this->once())
            ->method('warning')
            ->with($this->stringContains('sidGuard event=sidOpenRollbackFailed'));
        $socketIO = $this->makeSocketIO($provider, $logger);

        $method = new ReflectionMethod(SocketIO::class, 'rollbackSidAfterOpenFailure');
        $method->setAccessible(true);
        $method->invoke($socketIO, 22);
    }

    public function testIsConnSeqOverflowByExceptionCode(): void
    {
        $socketIO = $this->makeSocketIO(new PlainSidProvider('sid-test-server#1'));
        $method = new ReflectionMethod(SocketIO::class, 'isConnSeqOverflow');
        $method->setAccessible(true);

        $overflow = $method->invoke($socketIO, new RuntimeException('overflow', DistributedSidProvider::CONN_SEQ_OVERFLOW_CODE));
        $notOverflow = $method->invoke($socketIO, new RuntimeException('conn seq overflow'));

        $this->assertTrue($overflow);
        $this->assertFalse($notOverflow);
    }

    private function makeSocketIO(SidProviderInterface $provider, ?StdoutLoggerInterface $logger = null): SocketIO
    {
        $logger ??= $this->createMock(StdoutLoggerInterface::class);
        return new SocketIO(
            $logger,
            $this->createMock(Sender::class),
            $this->createMock(Decoder::class),
            $this->createMock(Encoder::class),
            $provider,
            new SocketIOConfig()
        );
    }
}

class LifecycleSidProvider implements SidProviderInterface, SidLifecycleProviderInterface
{
    public int $registerCalls = 0;

    public int $unregisterCalls = 0;

    public int $getSidCalls = 0;

    public int $lastUnregisterFd = -1;

    public function __construct(private readonly string $sid)
    {
    }

    public function getSid(int $fd): string
    {
        ++$this->getSidCalls;
        return $this->sid;
    }

    public function isLocal(string $sid): bool
    {
        return true;
    }

    public function getFd(string $sid): int
    {
        return 1;
    }

    public function registerConnection(int $fd): string
    {
        ++$this->registerCalls;
        return $this->sid;
    }

    public function unregisterConnection(int $fd): void
    {
        ++$this->unregisterCalls;
        $this->lastUnregisterFd = $fd;
    }
}

class PlainSidProvider implements SidProviderInterface
{
    public function __construct(private readonly string $sid)
    {
    }

    public function getSid(int $fd): string
    {
        return $this->sid;
    }

    public function isLocal(string $sid): bool
    {
        return true;
    }

    public function getFd(string $sid): int
    {
        return 1;
    }
}

class FailingLifecycleSidProvider extends LifecycleSidProvider
{
    public function unregisterConnection(int $fd): void
    {
        throw new RuntimeException('mock rollback failed');
    }
}
