<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Infrastructure\Core\ClassMap\SocketIoServer\Contract\SidLifecycleProviderInterface;
use App\Infrastructure\Core\ClassMap\SocketIoServer\DistributedSidCodec;
use Hyperf\SocketIOServer\NamespaceInterface;
use Hyperf\SocketIOServer\Room\RedisAdapter;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\SocketIOServer\SocketIO;
use Hyperf\WebSocketServer\Sender;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Redis;
use ReflectionClass;
use RuntimeException;
use Swow\Psr7\Server\ServerConnection;
use Swow\Socket;

// 纯单元测试不启动 Hyperf，因此显式加载应用实际配置的类覆盖。
require_once dirname(__DIR__, 3) . '/app/Infrastructure/Core/ClassMap/SocketIoServer/RedisAdapterV3.php';

/**
 * 使用合成数据和连接替身验证路由索引恢复及连接清理，不访问 Redis 或网络。
 * @internal
 */
final class RedisAdapterV3MaintenanceTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    private string $previousServerId;

    /** 隔离静态节点身份，避免影响其他测试。 */
    protected function setUp(): void
    {
        parent::setUp();
        $this->previousServerId = SocketIO::$serverId;
        SocketIO::$serverId = 'mock-maintenance-node';
    }

    /** 恢复测试前的节点身份。 */
    protected function tearDown(): void
    {
        SocketIO::$serverId = $this->previousServerId;
        parent::tearDown();
    }

    /** 校验真实错误会抛出异常，而合法的 false 或零结果保持原样。 */
    #[DataProvider('pipelineResults')]
    public function testPipelineDistinguishesCommandErrorsFromMissingKeys(array|false $result, ?string $error, bool $fails): void
    {
        $pipeline = $this->pipeline($result, $error);
        $redis = Mockery::mock(Redis::class);
        $redis->shouldReceive('pipeline')->once()->andReturn($pipeline);
        $adapter = $this->adapter($redis);
        if ($fails) {
            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage('Socket.IO Redis pipeline execution failed');
        }

        $actual = (new ReflectionClass($adapter))->getMethod('pipeline')->invoke(
            $adapter,
            $redis,
            static function (Redis $commands): void {
                $commands->expire('mock-missing-key', 300);
            }
        );

        self::assertSame($result, $actual);
    }

    /** 覆盖批量失败、单条失败、合法空键续期及零变更结果。 */
    public static function pipelineResults(): iterable
    {
        yield '整体失败' => [false, null, true];
        yield '单条类型错误' => [[false, true], 'WRONGTYPE mock command failed', true];
        yield '末条类型错误' => [[1, false], 'WRONGTYPE mock command failed', true];
        yield '空键续期' => [[0, false], null, false];
        yield '空错误状态' => [[0, false], '', false];
        yield '正常写入' => [[1, true], null, false];
    }

    /** 部分写入失败必须标脏，下一轮成功重建后才允许清除脏标记。 */
    #[DataProvider('rebuildResults')]
    public function testPartialFailureIsRebuiltOnNextRenewal(?string $rebuildError, bool $stillDirty): void
    {
        $redis = Mockery::mock(Redis::class);
        $redis->shouldReceive('pipeline')->times(3)->andReturn(
            $this->pipeline([false, true], 'WRONGTYPE mock command failed'),
            $this->pipeline([1, true]),
            $this->pipeline([0, 0, 1, false, true], $rebuildError)
        );
        $redis->shouldReceive('hKeys')->once()->andReturn([]);
        $adapter = $this->adapter($redis);
        $sid = DistributedSidCodec::buildSid(SocketIO::$serverId, (int) getmypid(), 1);

        $adapter->add($sid, $sid);
        self::assertTrue($this->property($adapter, 'indexDirty'));

        $adapter->renewLocalIndexLeases();
        self::assertSame($stillDirty, $this->property($adapter, 'indexDirty'));
        self::assertArrayHasKey($sid, $this->property($adapter, 'sidRooms'));
    }

    /** 重建成功与失败均使用合成命令结果，不依赖真实 Redis。 */
    public static function rebuildResults(): iterable
    {
        yield '重建成功' => [null, false];
        yield '重建再次失败' => ['WRONGTYPE mock rebuild failed', true];
    }

    /** 保留在线连接，回收失联房间，且不得撤销已属于其他 SID 的映射。 */
    #[DataProvider('connectionStates')]
    public function testCleanupRespectsConnectionStateAndSidOwnership(
        bool $hasConnection,
        bool $available,
        int $actualId,
        bool $local,
        bool $ownsMapping,
        bool $cleaned
    ): void {
        $sid = DistributedSidCodec::buildSid(SocketIO::$serverId, (int) getmypid(), 1);
        $provider = Mockery::mock(SidProviderInterface::class, SidLifecycleProviderInterface::class);
        $provider->shouldReceive('getFd')->with($sid)->once()->andReturn(101);
        $provider->shouldReceive('isLocal')->with($sid)->once()->andReturn($local);
        if ($cleaned) {
            $provider->shouldReceive('getSid')->with(101)->once()->andReturn($ownsMapping ? $sid : 'mock-new-sid');
        }
        $provider->shouldReceive('unregisterConnection')->with(101)->times($cleaned && $ownsMapping ? 1 : 0);
        $sender = Mockery::mock(Sender::class);
        $connection = null;
        if ($hasConnection) {
            $connection = Mockery::mock(ServerConnection::class);
            $connection->shouldReceive('getId')->andReturn($actualId);
            $socket = Mockery::mock(Socket::class);
            $socket->shouldReceive('isAvailable')->andReturn($available);
            $connection->shouldReceive('getSocket')->andReturn($socket);
        }
        $sender->shouldReceive('getResponse')->with(101)->once()->andReturn($connection);
        $redis = Mockery::mock(Redis::class);
        if ($cleaned) {
            $redis->shouldReceive('pipeline')->once()->andReturn($this->pipeline([1, 1, 0]));
        } else {
            $redis->shouldNotReceive('pipeline');
        }
        $adapter = $this->adapter($redis, $sender, $provider);
        $this->setProperty($adapter, 'sidRooms', [$sid => ['room:' . $sid => $sid]]);
        $this->setProperty($adapter, 'roomSids', ['room:' . $sid => [$sid => true]]);
        $this->setProperty($adapter, 'roomLocalCount', ['room:' . $sid => 1]);

        self::assertSame((int) $cleaned, $adapter->cleanUpLocalOrphanSidsOnce());
        self::assertSame($cleaned ? [] : [$sid], array_keys($this->property($adapter, 'sidRooms')));
        self::assertSame($cleaned ? [] : ['room:' . $sid => [$sid => true]], $this->property($adapter, 'roomSids'));
    }

    /** 清理检查覆盖在线、失联、关闭、身份不匹配及映射已被替换的连接。 */
    public static function connectionStates(): iterable
    {
        yield '在线连接' => [true, true, 101, true, true, false];
        yield '连接已丢失' => [false, false, 101, true, true, true];
        yield '套接字已关闭' => [true, false, 101, true, true, true];
        yield '连接身份不匹配' => [true, true, 102, true, true, true];
        yield '映射已被替换' => [false, false, 101, true, false, true];
        yield '非本地连接' => [true, true, 101, false, true, true];
    }

    /** 构建不连接外部服务的原生 Redis 替身，并约束错误状态的读取顺序。 */
    private function pipeline(array|false $result, ?string $error = null): Redis
    {
        $pipeline = Mockery::mock(Redis::class);
        $pipeline->shouldReceive('clearLastError')->once()->ordered()->andReturn(true);
        foreach (['hSet', 'hDel', 'del', 'expire', 'zAdd'] as $command) {
            $pipeline->shouldReceive($command)->andReturnSelf();
        }
        $pipeline->shouldReceive('exec')->once()->ordered()->andReturn($result);
        $pipeline->shouldReceive('getLastError')->once()->ordered()->andReturn($error);
        return $pipeline;
    }

    /** 注入维护逻辑依赖，跳过会加载应用配置的构造函数。 */
    private function adapter(Redis $redis, ?Sender $sender = null, ?SidProviderInterface $provider = null): RedisAdapter
    {
        $adapter = (new ReflectionClass(RedisAdapter::class))->newInstanceWithoutConstructor();
        $nsp = Mockery::mock(NamespaceInterface::class);
        $nsp->shouldReceive('getNamespace')->andReturn('/mock-maintenance');
        $this->setProperty($adapter, 'redis', $redis);
        $this->setProperty($adapter, 'sender', $sender ?? Mockery::mock(Sender::class));
        $this->setProperty($adapter, 'sidProvider', $provider ?? Mockery::mock(SidProviderInterface::class));
        $this->setProperty($adapter, 'nsp', $nsp);
        $this->setProperty($adapter, 'nextHeartbeatRefreshAtMs', PHP_INT_MAX);
        $adapter->logger = new NullLogger();
        return $adapter;
    }

    /** 设置内存索引及依赖，不暴露生产类内部状态。 */
    private function setProperty(RedisAdapter $adapter, string $name, mixed $value): void
    {
        (new ReflectionClass($adapter))->getProperty($name)->setValue($adapter, $value);
    }

    /** 读取维护后的索引状态以验证业务结果。 */
    private function property(RedisAdapter $adapter, string $name): mixed
    {
        return (new ReflectionClass($adapter))->getProperty($name)->getValue($adapter);
    }
}
