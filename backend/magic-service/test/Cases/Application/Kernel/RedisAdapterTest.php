<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Domain\Chat\Service\MessageContentProviderInterface;
use Hyperf\Engine\WebSocket\Frame;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Hyperf\SocketIOServer\NamespaceInterface;
use Hyperf\SocketIOServer\Room\RedisAdapter;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\SocketIOServer\SocketIO;
use Hyperf\WebSocketServer\Sender;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
class RedisAdapterTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    protected function setUp(): void
    {
        parent::setUp();
        SocketIO::$serverId = 'server-a';
    }

    protected function tearDown(): void
    {
        SocketIO::$serverId = '';
        parent::tearDown();
    }

    public function testLocalBroadcastUsesLocalRoomIndexOnly(): void
    {
        [$adapter, $redis, $queueRedis, $sender, $sidProvider] = $this->makeAdapter();

        $adapter->add('sid1', 'r1');

        $sidProvider->shouldReceive('isLocal')->once()->with('sid1')->andReturn(true);
        $sidProvider->shouldReceive('getFd')->once()->with('sid1')->andReturn(11);
        $sender->shouldReceive('pushFrame')
            ->once()
            ->withArgs(fn ($fd, $frame) => $fd === 11
                && $frame instanceof Frame
                && (string) $frame->getPayloadData() === 'packet');

        $adapter->broadcast('packet', ['flag' => ['local' => true], 'room' => 'r1']);

        $redis->shouldNotHaveReceived('sMembers');
        $redis->shouldNotHaveReceived('publish');
        $redis->shouldNotHaveReceived('scan');
        $queueRedis->shouldNotHaveReceived('lPush');
    }

    public function testAddWritesRoomNodeOnlyForFirstLocalSidInRoom(): void
    {
        [$adapter, $redis] = $this->makeAdapter();
        $nodeId = $this->nodeId('server-a');

        $adapter->add('sid1', 'r1');
        $adapter->add('sid2', 'r1');

        $redis->shouldHaveReceived('sAdd')
            ->with($this->roomNodesKey('r1'), $nodeId)
            ->once();
        $redis->shouldHaveReceived('expire')
            ->with($this->roomNodesKey('r1'), 86400)
            ->once();
        $redis->shouldHaveReceived('sAdd')
            ->with($this->nodeRoomsKey($nodeId), $this->hashValue('r1'))
            ->once();
        $redis->shouldHaveReceived('sAdd')
            ->with($this->nodeRoomSidsKey($nodeId, 'r1'), 'sid1')
            ->once();
        $redis->shouldHaveReceived('sAdd')
            ->with($this->nodeRoomSidsKey($nodeId, 'r1'), 'sid2')
            ->once();
        $redis->shouldNotHaveReceived('multi');
        $redis->shouldNotHaveReceived('scan');
    }

    public function testDelRemovesRoomNodeOnlyAfterLastLocalSidLeaves(): void
    {
        [$adapter, $redis] = $this->makeAdapter();
        $nodeId = $this->nodeId('server-a');

        $adapter->add('sid1', 'r1');
        $adapter->add('sid2', 'r1');
        $adapter->del('sid1', 'r1');
        $adapter->del('sid2', 'r1');

        $redis->shouldHaveReceived('sRem')
            ->with($this->roomNodesKey('r1'), $nodeId)
            ->once();
        $redis->shouldHaveReceived('del')
            ->with($this->nodeRoomSidsKey($nodeId, 'r1'))
            ->once();
        $redis->shouldNotHaveReceived('scan');
    }

    public function testNumericRoomIdKeepsStringSemantics(): void
    {
        [$adapter, $redis, , $sender, $sidProvider] = $this->makeAdapter();
        $nodeId = $this->nodeId('server-a');
        $room = '595693396611473408';

        $adapter->add('sid1', $room);

        $redis->shouldHaveReceived('sAdd')
            ->with($this->roomNodesKey($room), $nodeId)
            ->once();
        $redis->shouldHaveReceived('sAdd')
            ->with($this->sidRoomsKey('sid1'), $room)
            ->once();

        self::assertSame([$room], $adapter->clientRooms('sid1'));

        $sidProvider->shouldReceive('isLocal')->once()->with('sid1')->andReturn(true);
        $sidProvider->shouldReceive('getFd')->once()->with('sid1')->andReturn(11);
        $sender->shouldReceive('pushFrame')
            ->once()
            ->withArgs(fn ($fd, $frame) => $fd === 11
                && $frame instanceof Frame
                && (string) $frame->getPayloadData() === 'packet');

        $adapter->broadcast('packet', ['flag' => ['local' => true], 'room' => $room]);
        $redis->shouldNotHaveReceived('scan');
    }

    public function testAddDoesNotMutateLocalIndexWhenRedisWriteFails(): void
    {
        [$adapter, $redis, , $sender, $sidProvider] = $this->makeAdapter();
        $adapter->logger = new NullLogger();
        $nodeId = $this->nodeId('server-a');

        $redis->shouldReceive('sAdd')
            ->with($this->nodeRoomSidsKey($nodeId, 'r1'), 'sid1')
            ->once()
            ->andThrow(new RuntimeException('redis failed'));

        $this->expectException(RuntimeException::class);
        try {
            $adapter->add('sid1', 'r1');
        } finally {
            $sender->shouldReceive('pushFrame')->never();
            $sidProvider->shouldReceive('isLocal')->never();

            $adapter->broadcast('packet', ['flag' => ['local' => true], 'room' => 'r1']);
        }
    }

    public function testReconcileRouteIndexRebuildsLocalIndexesAndRemovesStaleRoom(): void
    {
        [$adapter, $redis] = $this->makeAdapter();
        $nodeId = $this->nodeId('server-a');
        $staleRoomHash = $this->hashValue('stale-room');

        $this->setPrivateProperty($adapter, 'roomSids', ['room:r1' => ['sid1' => true]]);
        $this->setPrivateProperty($adapter, 'sidRooms', ['sid1' => ['room:r1' => 'r1']]);
        $this->setPrivateProperty($adapter, 'roomLocalCount', ['room:r1' => 1]);

        $redis->shouldReceive('sMembers')
            ->with($this->nodeRoomsKey($nodeId))
            ->once()
            ->andReturn([$staleRoomHash]);

        $adapter->reconcileRouteIndex();

        $redis->shouldHaveReceived('sRem')
            ->with($this->roomNodesKeyByHash($staleRoomHash), $nodeId)
            ->once();
        $redis->shouldHaveReceived('del')
            ->with($this->nodeRoomSidsKeyByHash($nodeId, $staleRoomHash))
            ->once();
        $redis->shouldHaveReceived('sAdd')
            ->with($this->roomNodesKey('r1'), $nodeId)
            ->once();
        $redis->shouldHaveReceived('expire')
            ->with($this->roomNodesKey('r1'), 86400)
            ->once();
        $redis->shouldHaveReceived('sAdd')
            ->with($this->nodeRoomSidsKey($nodeId, 'r1'), 'sid1')
            ->once();
        $redis->shouldHaveReceived('sAdd')
            ->with($this->sidRoomsKey('sid1'), 'r1')
            ->once();
        $redis->shouldHaveReceived('sAdd')
            ->with($this->nodeSidsKey($nodeId), 'sid1')
            ->once();
        $redis->shouldHaveReceived('sAdd')
            ->with($this->nodeRoomsKey($nodeId), $this->hashValue('r1'))
            ->once();
        $redis->shouldNotHaveReceived('scan');
    }

    public function testRemoteBroadcastFansOutToTargetNodeQueues(): void
    {
        [$adapter, $redis, $queueRedis, $sender, $sidProvider] = $this->makeAdapter();
        $currentNodeId = $this->nodeId('server-a');
        $remoteNodeId = 'server-b:p222';
        $adapter->add('sid1', 'r1');

        $redis->shouldReceive('sMembers')
            ->with($this->roomNodesKey('r1'))
            ->once()
            ->andReturn([$currentNodeId, $remoteNodeId]);
        $redis->shouldReceive('zScore')
            ->with($this->nodesKey($this->nodeBucket($remoteNodeId)), $remoteNodeId)
            ->once()
            ->andReturn((string) (PHP_INT_MAX / 1000));

        $sidProvider->shouldReceive('isLocal')->once()->with('sid1')->andReturn(true);
        $sidProvider->shouldReceive('getFd')->once()->with('sid1')->andReturn(11);
        $sender->shouldReceive('pushFrame')->once();

        $adapter->broadcast('packet', ['rooms' => ['r1']]);

        $queueRedis->shouldHaveReceived('lPush')
            ->withArgs(function ($key, $payload) use ($remoteNodeId) {
                return $key === $this->nodeQueueKey($remoteNodeId, $this->laneForRoom('r1'))
                    && $this->payloadPacket($payload) === 'packet';
            })
            ->once();
        $queueRedis->shouldHaveReceived('lTrim')
            ->with($this->nodeQueueKey($remoteNodeId, $this->laneForRoom('r1')), 0, 9999)
            ->once();
        $queueRedis->shouldHaveReceived('expire')
            ->with($this->nodeQueueKey($remoteNodeId, $this->laneForRoom('r1')), 60)
            ->once();
        $redis->shouldNotHaveReceived('publish');
        $redis->shouldNotHaveReceived('scan');
    }

    public function testSameServerDifferentWorkerFansOutThroughQueue(): void
    {
        [$adapter, $redis, $queueRedis, $sender, $sidProvider] = $this->makeAdapter();
        $currentNodeId = $this->nodeId('server-a');
        $siblingNodeId = 'server-a:p999999';
        $adapter->add('sid1', 'r1');

        $redis->shouldReceive('sMembers')
            ->with($this->roomNodesKey('r1'))
            ->once()
            ->andReturn([$currentNodeId, $siblingNodeId]);
        $redis->shouldReceive('zScore')
            ->with($this->nodesKey($this->nodeBucket($siblingNodeId)), $siblingNodeId)
            ->once()
            ->andReturn((string) (PHP_INT_MAX / 1000));

        $sidProvider->shouldReceive('isLocal')->once()->with('sid1')->andReturn(true);
        $sidProvider->shouldReceive('getFd')->once()->with('sid1')->andReturn(11);
        $sender->shouldReceive('pushFrame')->once();

        $adapter->broadcast('packet', ['rooms' => ['r1']]);

        $queueRedis->shouldHaveReceived('lPush')
            ->withArgs(function ($key, $payload) use ($siblingNodeId) {
                return $key === $this->nodeQueueKey($siblingNodeId, $this->laneForRoom('r1'))
                    && $this->payloadPacket($payload) === 'packet';
            })
            ->once();
        $redis->shouldNotHaveReceived('publish');
        $redis->shouldNotHaveReceived('scan');
    }

    public function testRenewDoesNotWriteRedis(): void
    {
        [$adapter, $redis] = $this->makeAdapter();

        $adapter->renew('sid1');

        $redis->shouldNotHaveReceived('zAdd');
        $redis->shouldNotHaveReceived('zRangeByScore');
    }

    public function testCleanUpExpiredUsesNodeRoomsWithoutScan(): void
    {
        [$adapter, $redis, $queueRedis] = $this->makeAdapter();
        $nodeId = $this->nodeId('server-a');
        $deadNodeId = 'server-dead:p1';
        $this->setPrivateProperty($adapter, 'nodeBucketCount', 1);
        $this->setPrivateProperty($adapter, 'queueLaneCount', 2);

        $redis->shouldReceive('set')
            ->with($this->cleanupLockKey(0), $nodeId, Mockery::type('array'))
            ->once()
            ->andReturn(true);
        $redis->shouldReceive('zRangeByScore')
            ->withArgs(fn ($key, $min, $max, $options) => $key === $this->nodesKey(0)
                && $min === '-inf'
                && is_string($max)
                && $options === ['limit' => [0, 200]])
            ->once()
            ->andReturn([$deadNodeId]);
        $redis->shouldReceive('zScore')
            ->with($this->nodesKey(0), $deadNodeId)
            ->once()
            ->andReturn(false);
        $redis->shouldReceive('sMembers')
            ->with($this->nodeRoomsKey($deadNodeId))
            ->once()
            ->andReturn([$this->hashValue('r1')]);
        $redis->shouldReceive('sMembers')
            ->with($this->nodeSidsKey($deadNodeId))
            ->once()
            ->andReturn(['server-dead#1']);

        $adapter->cleanUpExpiredOnce();

        $redis->shouldHaveReceived('sRem')
            ->with($this->roomNodesKey('r1'), $deadNodeId)
            ->once();
        $redis->shouldHaveReceived('del')
            ->with($this->nodeRoomsKey($deadNodeId))
            ->once();
        $redis->shouldHaveReceived('del')
            ->with($this->sidRoomsKey('server-dead#1'))
            ->once();
        $redis->shouldHaveReceived('del')
            ->with($this->sidNodeKey('server-dead#1'))
            ->once();
        $redis->shouldHaveReceived('zRem')
            ->with($this->nodesKey(0), $deadNodeId)
            ->once();
        $queueRedis->shouldHaveReceived('del')->with($this->nodeQueueKey($deadNodeId, 0))->once();
        $queueRedis->shouldHaveReceived('del')->with($this->nodeQueueKey($deadNodeId, 1))->once();
        $redis->shouldNotHaveReceived('scan');
    }

    public function testGlobalBroadcastCachesActiveNodeBucketsBriefly(): void
    {
        [$adapter, $redis, $queueRedis] = $this->makeAdapter();
        $currentNodeId = $this->nodeId('server-a');
        $remoteNodeId = 'server-b:p222';
        $this->setPrivateProperty($adapter, 'nodeBucketCount', 2);

        $redis->shouldReceive('zRangeByScore')
            ->withArgs(fn ($key, $min, $max) => in_array($key, [$this->nodesKey(0), $this->nodesKey(1)], true)
                && is_string($min)
                && $max === '+inf')
            ->twice()
            ->andReturn([$currentNodeId], [$remoteNodeId]);

        $adapter->broadcast('packet-1', []);
        $adapter->broadcast('packet-2', []);

        $queueRedis->shouldHaveReceived('lPush')->twice();
        $redis->shouldNotHaveReceived('scan');
    }

    public function testQueuePayloadPushesOnlyLocalRoomSids(): void
    {
        [$adapter, , , $sender, $sidProvider] = $this->makeAdapter();
        $adapter->add('sid1', 'r1');

        $sidProvider->shouldReceive('isLocal')->once()->with('sid1')->andReturn(true);
        $sidProvider->shouldReceive('getFd')->once()->with('sid1')->andReturn(11);
        $sender->shouldReceive('pushFrame')
            ->once()
            ->withArgs(fn ($fd, $frame) => $fd === 11
                && $frame instanceof Frame
                && (string) $frame->getPayloadData() === 'packet');

        $method = new ReflectionMethod(RedisAdapter::class, 'handleQueuePayload');
        $method->setAccessible(true);
        $method->invoke($adapter, json_encode([
            'v' => 1,
            'packet' => base64_encode('packet'),
            'opts' => ['rooms' => ['r1']],
        ], JSON_THROW_ON_ERROR));
    }

    public function testMessageContentProviderResolvesPacketOnlyOncePerBroadcast(): void
    {
        [$adapter, , , $sender, $sidProvider] = $this->makeAdapter();
        $adapter->add('sid1', 'r1');
        $adapter->add('sid2', 'r1');

        $provider = Mockery::mock(MessageContentProviderInterface::class);
        $provider->shouldReceive('resolveActualPacket')->once()->with('packet')->andReturn('resolved');
        $this->setPrivateProperty($adapter, 'messageContentProvider', $provider);

        $sidProvider->shouldReceive('isLocal')->with('sid1')->once()->andReturn(true);
        $sidProvider->shouldReceive('isLocal')->with('sid2')->once()->andReturn(true);
        $sidProvider->shouldReceive('getFd')->with('sid1')->once()->andReturn(11);
        $sidProvider->shouldReceive('getFd')->with('sid2')->once()->andReturn(12);
        $sender->shouldReceive('pushFrame')
            ->twice()
            ->withArgs(fn ($fd, $frame) => in_array($fd, [11, 12], true)
                && $frame instanceof Frame
                && (string) $frame->getPayloadData() === 'resolved');

        $adapter->broadcast('packet', ['flag' => ['local' => true], 'rooms' => ['r1']]);
    }

    /**
     * @return array{RedisAdapter, RedisProxy, RedisProxy, Sender, SidProviderInterface}
     */
    private function makeAdapter(string $namespace = '/im'): array
    {
        [$redisFactory, $redis, $queueRedis, $sender, $nsp, $sidProvider] = $this->makeDependencies($namespace);
        $adapter = new RedisAdapter($redisFactory, $sender, $nsp, $sidProvider);
        return [$adapter, $redis, $queueRedis, $sender, $sidProvider];
    }

    /**
     * @return array{RedisFactory, RedisProxy, RedisProxy, Sender, NamespaceInterface, SidProviderInterface}
     */
    private function makeDependencies(string $namespace = '/im'): array
    {
        $redis = Mockery::spy(RedisProxy::class);
        $queueRedis = Mockery::spy(RedisProxy::class);
        $this->mockPipelineForwardingTo($redis);
        $this->mockPipelineForwardingTo($queueRedis);
        $redisFactory = Mockery::mock(RedisFactory::class);
        $sender = Mockery::mock(Sender::class);
        $nsp = Mockery::mock(NamespaceInterface::class);
        $sidProvider = Mockery::mock(SidProviderInterface::class);

        $redisFactory->shouldReceive('get')->once()->with('default')->andReturn($redis);
        $redisFactory->shouldReceive('get')->once()->with('socketio_queue')->andReturn($queueRedis);
        $nsp->shouldReceive('getNamespace')->andReturn($namespace);

        return [$redisFactory, $redis, $queueRedis, $sender, $nsp, $sidProvider];
    }

    private function mockPipelineForwardingTo(RedisProxy $redis): void
    {
        $redis->shouldReceive('pipeline')->andReturnUsing(static fn () => new class($redis) {
            public function __construct(private RedisProxy $redis)
            {
            }

            public function exec(): array
            {
                return [];
            }

            public function __call(string $method, array $arguments): self
            {
                $this->redis->{$method}(...$arguments);
                return $this;
            }
        });
    }

    private function setPrivateProperty(object $object, string $property, mixed $value): void
    {
        $reflectionProperty = new ReflectionProperty($object, $property);
        $reflectionProperty->setAccessible(true);
        $reflectionProperty->setValue($object, $value);
    }

    private function roomNodesKey(string $room, string $namespace = '/im'): string
    {
        return $this->roomNodesKeyByHash($this->hashValue($room), $namespace);
    }

    private function roomNodesKeyByHash(string $roomHash, string $namespace = '/im'): string
    {
        return sprintf(
            'magicChat:SocketIo:RedisAdapter:v2:%s:room_nodes:%s:%s',
            $this->clusterRouteTag('room_nodes:' . $this->hashValue($namespace) . ':' . $roomHash),
            $this->hashValue($namespace),
            $roomHash
        );
    }

    private function nodeRoomsKey(string $nodeId, string $namespace = '/im'): string
    {
        return sprintf(
            'magicChat:SocketIo:RedisAdapter:v2:%s:node_rooms:%s:%s',
            $this->clusterRouteTag('node:' . $this->hashValue($namespace) . ':' . $nodeId),
            $this->hashValue($namespace),
            $nodeId
        );
    }

    private function nodeSidsKey(string $nodeId, string $namespace = '/im'): string
    {
        return sprintf(
            'magicChat:SocketIo:RedisAdapter:v2:%s:node_sids:%s:%s',
            $this->clusterRouteTag('node:' . $this->hashValue($namespace) . ':' . $nodeId),
            $this->hashValue($namespace),
            $nodeId
        );
    }

    private function nodeRoomSidsKey(string $nodeId, string $room, string $namespace = '/im'): string
    {
        return $this->nodeRoomSidsKeyByHash($nodeId, $this->hashValue($room), $namespace);
    }

    private function nodeRoomSidsKeyByHash(string $nodeId, string $roomHash, string $namespace = '/im'): string
    {
        return sprintf(
            'magicChat:SocketIo:RedisAdapter:v2:%s:node_room_sids:%s:%s:%s',
            $this->clusterRouteTag('node_room_sids:' . $this->hashValue($namespace) . ':' . $nodeId . ':' . $roomHash),
            $this->hashValue($namespace),
            $nodeId,
            $roomHash
        );
    }

    private function sidRoomsKey(string $sid, string $namespace = '/im'): string
    {
        $sidHash = $this->hashValue($sid);
        return sprintf(
            'magicChat:SocketIo:RedisAdapter:v2:%s:sid_rooms:%s:%s',
            $this->clusterRouteTag('sid:' . $this->hashValue($namespace) . ':' . $sidHash),
            $this->hashValue($namespace),
            $sidHash
        );
    }

    private function sidNodeKey(string $sid, string $namespace = '/im'): string
    {
        $sidHash = $this->hashValue($sid);
        return sprintf(
            'magicChat:SocketIo:RedisAdapter:v2:%s:sid_node:%s:%s',
            $this->clusterRouteTag('sid:' . $this->hashValue($namespace) . ':' . $sidHash),
            $this->hashValue($namespace),
            $sidHash
        );
    }

    private function nodesKey(int $bucket): string
    {
        return sprintf(
            'magicChat:SocketIo:RedisAdapter:v2:%s:nodes:%d',
            $this->clusterRouteTag('nodes:' . $bucket),
            $bucket
        );
    }

    private function nodeQueueKey(string $nodeId, int $lane, string $namespace = '/im'): string
    {
        return sprintf(
            'magicChat:SocketIo:RedisAdapter:v2:%s:node_queue:%s:%s:%d',
            $this->clusterRouteTag('node_queue:' . $this->hashValue($namespace) . ':' . $nodeId . ':' . $lane),
            $this->hashValue($namespace),
            $nodeId,
            $lane
        );
    }

    private function cleanupLockKey(int $bucket): string
    {
        return sprintf(
            'magicChat:SocketIo:RedisAdapter:v2:%s:cleanup_lock:%d',
            $this->clusterRouteTag('nodes:' . $bucket),
            $bucket
        );
    }

    private function nodeBucket(string $nodeId): int
    {
        return (int) (sprintf('%u', crc32($nodeId)) % 128);
    }

    private function laneForRoom(string $room): int
    {
        return (int) (sprintf('%u', crc32($this->hashValue($room))) % 8);
    }

    private function payloadPacket(string $payload): ?string
    {
        $data = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        $packet = base64_decode((string) ($data['packet'] ?? ''), true);
        return $packet === false ? null : $packet;
    }

    private function hashValue(string $value): string
    {
        return sha1($value);
    }

    private function clusterRouteTag(string $routeSeed): string
    {
        return '{socketio:' . $this->hashValue($routeSeed) . '}';
    }

    private function nodeId(string $serverId): string
    {
        $pid = getmypid();
        if ($pid === false) {
            $pid = 0;
        }
        return $serverId . ':p' . $pid;
    }
}
