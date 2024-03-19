<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use Exception;
use Hyperf\Engine\WebSocket\Frame;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Hyperf\SocketIOServer\NamespaceInterface;
use Hyperf\SocketIOServer\Room\RedisAdapter;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\WebSocketServer\Sender;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionMethod;
use ReflectionProperty;

/**
 * @internal
 */
class RedisAdapterTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    public function testBroadcastSupportsRoomOption(): void
    {
        [$adapter, $redis, $sender, $sidProvider] = $this->makeAdapter();

        $redis->shouldReceive('sMembers')
            ->once()
            ->with($this->roomKey('r1'))
            ->andReturn(['sid1']);
        $sidProvider->shouldReceive('isLocal')
            ->once()
            ->with('sid1')
            ->andReturn(true);
        $sidProvider->shouldReceive('getFd')
            ->once()
            ->with('sid1')
            ->andReturn(11);
        $sender->shouldReceive('pushFrame')
            ->once()
            ->withArgs(function ($fd, $frame) {
                return $fd === 11 && $frame instanceof Frame && (string) $frame->getPayloadData() === 'packet';
            });

        $adapter->broadcast('packet', ['flag' => ['local' => true], 'room' => 'r1']);
    }

    public function testCleanUpExpiredOnceCallsDisconnectSidOnlyOncePerSid(): void
    {
        [$redisFactory, $redis, $sender, $namespace, $sidProvider] = $this->makeDependencies();
        $adapter = Mockery::mock(RedisAdapter::class . '[disconnectSid]', [$redisFactory, $sender, $namespace, $sidProvider])->makePartial();

        $redis->shouldReceive('zRangeByScore')
            ->twice()
            ->withArgs(function ($key, $min, $max, $options) {
                return $key === $this->expireKey()
                    && $min === '-inf'
                    && is_string($max)
                    && is_array($options)
                    && isset($options['limit'])
                    && $options['limit'] === [0, 1000];
            })
            ->andReturn(['sid1', 'sid2'], []);
        $redis->shouldReceive('zRem')->never();

        $adapter->shouldReceive('disconnectSid')->once()->with('sid1');
        $adapter->shouldReceive('disconnectSid')->once()->with('sid2');

        $adapter->cleanUpExpiredOnce();
    }

    public function testCleanUpExpiredOnceProcessesMultipleBatches(): void
    {
        [$redisFactory, $redis, $sender, $namespace, $sidProvider] = $this->makeDependencies();
        $adapter = Mockery::mock(RedisAdapter::class . '[disconnectSid]', [$redisFactory, $sender, $namespace, $sidProvider])->makePartial();

        $batchSizeProperty = new ReflectionProperty(RedisAdapter::class, 'cleanUpExpiredBatchSize');
        $batchSizeProperty->setAccessible(true);
        $batchSizeProperty->setValue($adapter, 2);

        $redis->shouldReceive('zRangeByScore')
            ->times(3)
            ->withArgs(function ($key, $min, $max, $options) {
                return $key === $this->expireKey()
                    && $min === '-inf'
                    && is_string($max)
                    && is_array($options)
                    && isset($options['limit'])
                    && $options['limit'] === [0, 2];
            })
            ->andReturn(['sid1', 'sid2'], ['sid3'], []);

        $adapter->shouldReceive('disconnectSid')->once()->with('sid1');
        $adapter->shouldReceive('disconnectSid')->once()->with('sid2');
        $adapter->shouldReceive('disconnectSid')->once()->with('sid3');

        $adapter->cleanUpExpiredOnce();
    }

    public function testAddExecutesExpireWriteOnceForMultiRooms(): void
    {
        [$adapter, $redis] = $this->makeAdapter();
        $adapter->setTtl(5000);

        $redis->shouldReceive('multi')->once();
        $redis->shouldReceive('sAdd')->once()->with($this->sidKey('sid1'), 'r1', 'r2');
        $redis->shouldReceive('sAdd')->once()->with($this->roomKey('r1'), 'sid1');
        $redis->shouldReceive('sAdd')->once()->with($this->roomKey('r2'), 'sid1');
        $redis->shouldReceive('zAdd')
            ->once()
            ->withArgs(function ($key, $score, $sid) {
                return $key === $this->expireKey() && is_numeric($score) && $sid === 'sid1';
            });
        $redis->shouldReceive('sAdd')->once()->with($this->statKey(), 'sid1');
        $redis->shouldReceive('exec')->once();

        $adapter->add('sid1', 'r1', 'r2');
    }

    public function testBroadcastSkipsExceptSidWithoutLocalCheck(): void
    {
        [$adapter, $redis, $sender, $sidProvider] = $this->makeAdapter();

        $redis->shouldReceive('sMembers')
            ->once()
            ->with($this->roomKey('r1'))
            ->andReturn(['sid1']);
        $sidProvider->shouldReceive('isLocal')->never();
        $sender->shouldReceive('pushFrame')->never();

        $adapter->broadcast('packet', [
            'flag' => ['local' => true],
            'rooms' => ['r1'],
            'except' => ['sid1'],
        ]);
    }

    public function testDisconnectSidStillCleansRouteWhenCloseFdFails(): void
    {
        [$adapter, $redis, $sender, $sidProvider] = $this->makeAdapter();
        $logger = Mockery::mock(LoggerInterface::class);
        $adapter->logger = $logger;

        $logger->shouldReceive('info')
            ->once()
            ->withArgs(fn ($message) => is_string($message) && str_contains($message, 'sidGuard event=disconnectSidTriggered'));
        $logger->shouldReceive('warning')
            ->once()
            ->withArgs(fn ($message) => is_string($message) && str_contains($message, 'sidGuard event=closeFdFailed'));

        $sidProvider->shouldReceive('isLocal')->once()->with('sid1')->andReturn(true);
        $sidProvider->shouldReceive('getFd')->once()->with('sid1')->andReturn(10);
        $sender->shouldReceive('disconnect')->once()->with(10)->andThrow(new Exception('socket already closed'));

        $redis->shouldReceive('sMembers')->once()->with($this->sidKey('sid1'))->andReturn([]);
        $redis->shouldReceive('multi')->once();
        $redis->shouldReceive('del')->once()->with($this->sidKey('sid1'));
        $redis->shouldReceive('sRem')->once()->with($this->statKey(), 'sid1');
        $redis->shouldReceive('zRem')->once()->with($this->expireKey(), 'sid1');
        $redis->shouldReceive('exec')->once();

        $adapter->disconnectSid('sid1');
    }

    public function testPhpRedisSubscribeLogsWhenPayloadContainsObject(): void
    {
        [$adapter] = $this->makeAdapter();
        $logger = Mockery::mock(LoggerInterface::class);
        $adapter->logger = $logger;

        $logger->shouldReceive('warning')
            ->once()
            ->withArgs(function ($message) {
                return is_string($message)
                    && str_contains($message, 'sidGuard event=subscribePayloadObjectDetected')
                    && str_contains($message, TestPayloadObject::class);
            });

        $method = new ReflectionMethod(RedisAdapter::class, 'logSubscribePayloadObjectTypes');
        $method->setAccessible(true);
        $method->invoke($adapter, ['payload' => new TestPayloadObject()], ['meta' => []]);
    }

    /**
     * @return array{RedisAdapter, RedisProxy, Sender, SidProviderInterface}
     */
    private function makeAdapter(string $namespace = '/im'): array
    {
        [$redisFactory, $redis, $sender, $nsp, $sidProvider] = $this->makeDependencies($namespace);
        $adapter = new RedisAdapter($redisFactory, $sender, $nsp, $sidProvider);
        return [$adapter, $redis, $sender, $sidProvider];
    }

    /**
     * @return array{RedisFactory, RedisProxy, Sender, NamespaceInterface, SidProviderInterface}
     */
    private function makeDependencies(string $namespace = '/im'): array
    {
        $redis = Mockery::mock(RedisProxy::class);
        $redisFactory = Mockery::mock(RedisFactory::class);
        $sender = Mockery::mock(Sender::class);
        $nsp = Mockery::mock(NamespaceInterface::class);
        $sidProvider = Mockery::mock(SidProviderInterface::class);

        $redisFactory->shouldReceive('get')->once()->with('default')->andReturn($redis);
        $nsp->shouldReceive('getNamespace')->andReturn($namespace);

        return [$redisFactory, $redis, $sender, $nsp, $sidProvider];
    }

    private function roomKey(string $room, string $namespace = '/im'): string
    {
        return sprintf('magicChat:SocketIo:RedisAdapter:%s:rooms:%s', $namespace, $room);
    }

    private function sidKey(string $sid, string $namespace = '/im'): string
    {
        return sprintf('magicChat:SocketIo:RedisAdapter:%s:fds:%s', $namespace, $sid);
    }

    private function statKey(string $namespace = '/im'): string
    {
        return sprintf('magicChat:SocketIo:RedisAdapter:%s:stat', $namespace);
    }

    private function expireKey(string $namespace = '/im'): string
    {
        return sprintf('magicChat:SocketIo:RedisAdapter:%s:expire', $namespace);
    }
}

class TestPayloadObject
{
}
