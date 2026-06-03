<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Infrastructure\Core\ClassMap\SocketIoServer\DistributedSidCodec;
use Hyperf\Engine\Contract\WebSocket\FrameInterface;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Hyperf\SocketIOServer\NamespaceInterface;
use Hyperf\SocketIOServer\Room\AdapterInterface;
use Hyperf\SocketIOServer\Room\RedisAdapter;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\SocketIOServer\SocketIO;
use Hyperf\WebSocketServer\Sender;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;
use Redis;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;
use Throwable;

/**
 * @internal
 */
class RedisAdapterV3Test extends TestCase
{
    use MockeryPHPUnitIntegration;

    private const string PREFIX = 'magicChat:SocketIo:RedisAdapter:v3';

    private Redis $nativeRedis;

    private string $namespace;

    /**
     * @var string[]
     */
    private array $serverIds = [];

    /**
     * @var string[]
     */
    private array $rooms = [];

    protected function setUp(): void
    {
        parent::setUp();
        $adapterReflection = new ReflectionClass(RedisAdapter::class);
        if (basename((string) $adapterReflection->getFileName()) !== 'RedisAdapterV3.php') {
            self::markTestSkipped('RedisAdapterV3Test targets RedisAdapterV3.');
        }

        $suffix = bin2hex(random_bytes(4));
        $this->namespace = '/im-v3-' . $suffix;
        $this->serverIds = ['server-a-' . $suffix, 'server-b-' . $suffix, 'server-dead-' . $suffix];
        $this->rooms = [
            'magic-user-1001-' . $suffix,
            'magic-user-2002-' . $suffix,
            'magic-user-3003-' . $suffix,
            'magic-user-4004-' . $suffix,
        ];

        $this->setEnv('SOCKETIO_INDEX_TTL_SECONDS', '300');
        $this->setEnv('SOCKETIO_INDEX_RENEW_MS', '60000');
        $this->setEnv('SOCKETIO_LOCAL_CLEANUP_MS', '60000');
        $this->setEnv('SOCKETIO_LOCAL_CLEANUP_BATCH_SIZE', '5000');
        $this->setEnv('SOCKETIO_QUEUE_LANE_COUNT', '4');
        $this->setEnv('SOCKETIO_QUEUE_TTL_SECONDS', '60');

        $this->nativeRedis = $this->connectRedis();
        $this->cleanupExactKeys(array_merge(
            $this->buildKnownKeys($this->rooms, $this->serverIds),
            $this->buildCleanupLockKeys()
        ));
    }

    protected function tearDown(): void
    {
        try {
            $this->cleanupExactKeys(array_merge(
                $this->buildKnownKeys($this->rooms, $this->serverIds),
                $this->buildCleanupLockKeys()
            ));
        } catch (Throwable) {
        }
        SocketIO::$serverId = '';
        parent::tearDown();
    }

    public function testSidSelfRoomDoesNotCreateRedisRoomNodeKey(): void
    {
        [$adapter, $redis, , , $sidProvider] = $this->makeAdapter();
        $sid = $this->sid($this->serverIds[0], 1);
        $sidProvider->activate($sid, 101);

        $this->withServer($this->serverIds[0], fn () => $adapter->add($sid, $sid));

        self::assertSame(0, (int) $this->nativeRedis->exists($this->roomNodesKey($sid)));
        self::assertSame('[]', $this->nativeRedis->hGet($this->nodeSidRoomsKey($this->nodeId($this->serverIds[0])), $sid));
        self::assertSame([$sid], $this->withServer($this->serverIds[0], fn () => $adapter->clientRooms($sid)));
        self::assertSame(0, $redis->callCount('scan'));
    }

    public function testBusinessRoomBroadcastFansOutAcrossNodesWithoutRedisPubSub(): void
    {
        [$adapterA, $redis, $queueRedis, $senderA, $providerA] = $this->makeAdapter();
        [$adapterB, , , $senderB, $providerB] = $this->makeAdapter($redis, $queueRedis);
        $room = $this->rooms[0];
        $sidA = $this->sid($this->serverIds[0], 1);
        $sidB = $this->sid($this->serverIds[1], 1);
        $providerA->activate($sidA, 101);
        $providerB->activate($sidB, 201);

        $this->withServer($this->serverIds[0], fn () => [$adapterA->add($sidA, $sidA), $adapterA->add($sidA, $room)]);
        $this->withServer($this->serverIds[1], fn () => [$adapterB->add($sidB, $sidB), $adapterB->add($sidB, $room)]);

        $this->withServer($this->serverIds[0], fn () => $adapterA->broadcast('packet-user-1001', ['rooms' => [$room]]));

        self::assertSame([[101, 'packet-user-1001']], $senderA->pushes);
        self::assertSame(0, $redis->callCount('publish'));
        self::assertSame(0, $redis->callCount('scan'));

        $payload = $this->popFirstQueuePayload($this->nodeId($this->serverIds[1]));
        self::assertIsString($payload);
        $this->withServer($this->serverIds[1], fn () => $this->handleQueuePayload($adapterB, $payload));

        self::assertSame([[201, 'packet-user-1001']], $senderB->pushes);
    }

    public function testClientsAndClientRoomsAreEventuallyConsistentAcrossNodes(): void
    {
        [$adapterA, $redis, $queueRedis, , $providerA] = $this->makeAdapter();
        [$adapterB, , , , $providerB] = $this->makeAdapter($redis, $queueRedis);
        $room = $this->rooms[1];
        $sidA = $this->sid($this->serverIds[0], 1);
        $sidB = $this->sid($this->serverIds[1], 1);
        $providerA->activate($sidA, 101);
        $providerB->activate($sidB, 201);

        $this->withServer($this->serverIds[0], fn () => [$adapterA->add($sidA, $sidA), $adapterA->add($sidA, $room)]);
        $this->withServer($this->serverIds[1], fn () => [$adapterB->add($sidB, $sidB), $adapterB->add($sidB, $room)]);

        self::assertEqualsCanonicalizing(
            [$sidA, $sidB],
            $this->withServer($this->serverIds[0], fn () => $adapterA->clients($room))
        );
        self::assertEqualsCanonicalizing(
            [$room, $sidB],
            $this->withServer($this->serverIds[0], fn () => $adapterA->clientRooms($sidB))
        );
    }

    public function testCreatedRedisKeysAlwaysHaveShortTtl(): void
    {
        [$adapterA, $redis, $queueRedis, , $providerA] = $this->makeAdapter();
        [$adapterB, , , , $providerB] = $this->makeAdapter($redis, $queueRedis);
        $room = $this->rooms[0];
        $sidA = $this->sid($this->serverIds[0], 1);
        $sidB = $this->sid($this->serverIds[1], 1);
        $providerA->activate($sidA, 101);
        $providerB->activate($sidB, 201);

        $this->withServer($this->serverIds[0], fn () => [$adapterA->add($sidA, $sidA), $adapterA->add($sidA, $room)]);
        $this->withServer($this->serverIds[1], fn () => [$adapterB->add($sidB, $sidB), $adapterB->add($sidB, $room)]);
        $this->withServer($this->serverIds[0], fn () => $adapterA->broadcast('ttl-packet', ['rooms' => [$room]]));
        $this->withServer($this->serverIds[0], fn () => $adapterA->cleanUpExpiredOnce());

        $nodeA = $this->nodeId($this->serverIds[0]);
        $nodeB = $this->nodeId($this->serverIds[1]);
        $this->assertRedisKeyHasTtl($this->roomNodesKey($room), 300);
        $this->assertRedisKeyHasTtl($this->nodeRoomSidsKey($nodeA), 300);
        $this->assertRedisKeyHasTtl($this->nodeSidRoomsKey($nodeA), 300);
        $this->assertRedisKeyHasTtl($this->nodesKeyForNode($nodeA), 300);
        $this->assertAnyQueueLaneHasTtl($nodeB, 60);
        $this->assertRedisKeyHasTtl($this->cleanupLockKeyForNode($nodeA), 60);
        self::assertSame(0, $redis->callCount('scan'));
    }

    public function testRuntimeConfigCapsLongRedisKeyTtls(): void
    {
        $this->setEnv('SOCKETIO_NODE_HEARTBEAT_MS', '3600000');
        $this->setEnv('SOCKETIO_NODE_EXPIRE_MS', '3600000');
        $this->setEnv('SOCKETIO_INDEX_RENEW_MS', '3600000');
        $this->setEnv('SOCKETIO_INDEX_TTL_SECONDS', '3600');
        $this->setEnv('SOCKETIO_QUEUE_TTL_SECONDS', '3600');

        [$adapterA, , $queueRedis, , $providerA] = $this->makeAdapter();
        [$adapterB, , , , $providerB] = $this->makeAdapter(null, $queueRedis);
        $room = $this->rooms[0];
        $sidA = $this->sid($this->serverIds[0], 1);
        $sidB = $this->sid($this->serverIds[1], 1);
        $providerA->activate($sidA, 101);
        $providerB->activate($sidB, 201);

        $this->withServer($this->serverIds[0], fn () => [$adapterA->add($sidA, $sidA), $adapterA->add($sidA, $room)]);
        $this->withServer($this->serverIds[1], fn () => [$adapterB->add($sidB, $sidB), $adapterB->add($sidB, $room)]);
        $this->withServer($this->serverIds[0], fn () => $adapterA->broadcast('ttl-cap-packet', ['rooms' => [$room]]));

        $this->assertRedisKeyHasTtl($this->roomNodesKey($room), 300);
        $this->assertRedisKeyHasTtl($this->nodesKeyForNode($this->nodeId($this->serverIds[0])), 300);
        $this->assertAnyQueueLaneHasTtl($this->nodeId($this->serverIds[1]), 60);
    }

    public function testDeletePathsRepairHistoricalKeysWithoutTtl(): void
    {
        [$adapterA, $redis, $queueRedis, , $providerA] = $this->makeAdapter();
        [$adapterB, , , , $providerB] = $this->makeAdapter($redis, $queueRedis);
        $roomA = $this->rooms[0];
        $roomB = $this->rooms[1];
        $sidA1 = $this->sid($this->serverIds[0], 1);
        $sidA2 = $this->sid($this->serverIds[0], 2);
        $sidB = $this->sid($this->serverIds[1], 1);
        $providerA->activate($sidA1, 101);
        $providerA->activate($sidA2, 102);
        $providerB->activate($sidB, 201);

        $this->withServer($this->serverIds[0], fn () => [
            $adapterA->add($sidA1, $sidA1),
            $adapterA->add($sidA1, $roomA),
            $adapterA->add($sidA1, $roomB),
            $adapterA->add($sidA2, $sidA2),
            $adapterA->add($sidA2, $roomB),
        ]);
        $this->withServer($this->serverIds[1], fn () => [$adapterB->add($sidB, $sidB), $adapterB->add($sidB, $roomA)]);

        $nodeA = $this->nodeId($this->serverIds[0]);
        $keys = [
            $this->roomNodesKey($roomA),
            $this->nodeRoomSidsKey($nodeA),
            $this->nodeSidRoomsKey($nodeA),
        ];
        foreach ($keys as $key) {
            $this->nativeRedis->persist($key);
            self::assertSame(-1, $this->nativeRedis->ttl($key));
        }

        $this->withServer($this->serverIds[0], fn () => $adapterA->del($sidA1, $roomA));
        $this->withServer($this->serverIds[0], fn () => $adapterA->del($sidA2));

        foreach ($keys as $key) {
            $this->assertRedisKeyHasTtl($key, 300);
        }
        self::assertSame(0, $redis->callCount('scan'));
    }

    public function testDirtyRenewRebuildsLocalRouteIndexAndRemovesStaleFields(): void
    {
        [$adapter, $redis, , , $provider] = $this->makeAdapter();
        $activeRoom = $this->rooms[0];
        $staleRoom = $this->rooms[1];
        $sid = $this->sid($this->serverIds[0], 1);
        $staleSid = $this->sid($this->serverIds[0], 99);
        $nodeId = $this->nodeId($this->serverIds[0]);
        $staleRoomHash = sha1($staleRoom);
        $provider->activate($sid, 101);

        $this->withServer($this->serverIds[0], fn () => [$adapter->add($sid, $sid), $adapter->add($sid, $activeRoom)]);
        $this->nativeRedis->hSet($this->nodeSidRoomsKey($nodeId), $staleSid, json_encode([$staleRoom], JSON_THROW_ON_ERROR));
        $this->nativeRedis->hSet($this->nodeRoomSidsKey($nodeId), $staleRoomHash, json_encode([$staleSid], JSON_THROW_ON_ERROR));
        $this->nativeRedis->sAdd($this->roomNodesKey($staleRoom), $nodeId);
        $this->setPrivateProperty($adapter, 'indexDirty', true);

        $this->withServer($this->serverIds[0], fn () => $adapter->renewLocalIndexLeases());

        self::assertFalse($this->nativeRedis->hGet($this->nodeSidRoomsKey($nodeId), $staleSid));
        self::assertFalse($this->nativeRedis->hGet($this->nodeRoomSidsKey($nodeId), $staleRoomHash));
        self::assertNotContains($nodeId, $this->nativeRedis->sMembers($this->roomNodesKey($staleRoom)));
        self::assertSame(json_encode([$activeRoom], JSON_THROW_ON_ERROR), $this->nativeRedis->hGet($this->nodeSidRoomsKey($nodeId), $sid));
        self::assertSame(0, $redis->callCount('scan'));
    }

    public function testQueueBacklogLeaseIsRenewedWhileConsuming(): void
    {
        [$adapter] = $this->makeAdapter();
        $nodeId = $this->nodeId($this->serverIds[0]);
        $queueKey = $this->nodeQueueKey($nodeId, 0);
        $this->nativeRedis->lPush($queueKey, 'payload-1', 'payload-2');
        $this->nativeRedis->expire($queueKey, 1);

        $this->refreshQueueLeaseIfDue($adapter, $queueKey, 0);

        $this->assertRedisKeyHasTtl($queueKey, 60);
    }

    public function testQueueLeaseRefreshFailureDoesNotDelayRetry(): void
    {
        [$adapter] = $this->makeAdapter();

        $this->setPrivateProperty($adapter, 'nextQueueLeaseRefreshAtMs', [0 => 0]);
        $this->refreshQueueLeaseIfDue($adapter, 'invalid-list-key', 0);

        self::assertSame(0, $this->privateProperty($adapter, 'nextQueueLeaseRefreshAtMs')[0] ?? 0);
    }

    public function testLocalOrphanCleanupRemovesInactiveSidWithoutRedisScan(): void
    {
        [$adapter, $redis, , , $sidProvider] = $this->makeAdapter();
        $room = $this->rooms[2];
        $sid = $this->sid($this->serverIds[0], 1);
        $sidProvider->activate($sid, 101);
        $this->withServer($this->serverIds[0], fn () => [$adapter->add($sid, $sid), $adapter->add($sid, $room)]);

        $sidProvider->deactivate($sid);
        $cleaned = $this->withServer($this->serverIds[0], fn () => $adapter->cleanUpLocalOrphanSidsOnce());

        self::assertSame(1, $cleaned);
        self::assertSame(['sid_count' => 0, 'room_count' => 0, 'edge_count' => 0], $this->localStats($adapter));
        self::assertSame([], $this->nativeRedis->sMembers($this->roomNodesKey($room)));
        self::assertSame(0, $redis->callCount('scan'));
    }

    public function testRenewDoesNotWriteRedis(): void
    {
        [$adapter, $redis] = $this->makeAdapter();
        $redis->resetCallCounts();

        $adapter->renew($this->sid($this->serverIds[0], 1));

        self::assertSame(0, $redis->callCount('zAdd'));
        self::assertSame(0, $redis->callCount('expire'));
        self::assertSame(0, $redis->callCount('scan'));
    }

    public function testDeadNodeCleanupUsesExactNodeHashesWithoutScan(): void
    {
        [$adapterA, $redis, $queueRedis, , $providerA] = $this->makeAdapter();
        [$adapterDead, , , , $providerDead] = $this->makeAdapter($redis, $queueRedis);
        $room = $this->rooms[3];
        $sidA = $this->sid($this->serverIds[0], 1);
        $sidDead = $this->sid($this->serverIds[2], 1);
        $providerA->activate($sidA, 101);
        $providerDead->activate($sidDead, 301);

        $this->withServer($this->serverIds[0], fn () => [$adapterA->add($sidA, $sidA), $adapterA->add($sidA, $room)]);
        $this->withServer($this->serverIds[2], fn () => [$adapterDead->add($sidDead, $sidDead), $adapterDead->add($sidDead, $room)]);
        $this->nativeRedis->zAdd($this->nodesKeyForNode($this->nodeId($this->serverIds[2])), 1, $this->nodeId($this->serverIds[2]));
        $this->nativeRedis->lPush($this->nodeQueueKey($this->nodeId($this->serverIds[2]), 0), 'payload');
        $this->nativeRedis->del($this->cleanupLockKeyForNode($this->nodeId($this->serverIds[2])));

        $this->withServer($this->serverIds[0], fn () => $adapterA->cleanUpExpiredOnce());

        self::assertNotContains($this->nodeId($this->serverIds[2]), $this->nativeRedis->sMembers($this->roomNodesKey($room)));
        self::assertSame(0, (int) $this->nativeRedis->exists($this->nodeRoomSidsKey($this->nodeId($this->serverIds[2]))));
        self::assertSame(0, (int) $this->nativeRedis->exists($this->nodeSidRoomsKey($this->nodeId($this->serverIds[2]))));
        self::assertSame(0, $redis->callCount('scan'));
    }

    public function testHighFrequencyReconnectDoesNotGrowRedisKeysOrLocalIndexesByHistory(): void
    {
        [$adapter, $redis, , , $sidProvider] = $this->makeAdapter();
        $userCount = 1000;
        $tabsPerUser = 3;
        $reconnectRounds = 20;
        $rooms = [];
        for ($user = 1; $user <= $userCount; ++$user) {
            $rooms[] = 'churn-user-' . $this->namespace . '-' . $user;
        }
        $this->rooms = array_values(array_unique(array_merge($this->rooms, $rooms)));

        $seq = 0;
        $activeSids = [];
        gc_collect_cycles();
        $memoryBefore = memory_get_usage(false);

        for ($round = 0; $round < $reconnectRounds; ++$round) {
            $newActiveSids = [];
            foreach ($rooms as $room) {
                for ($tab = 1; $tab <= $tabsPerUser; ++$tab) {
                    ++$seq;
                    $sid = $this->sid($this->serverIds[0], $seq);
                    $sidProvider->activate($sid, $seq);
                    $this->withServer($this->serverIds[0], fn () => [$adapter->add($sid, $sid), $adapter->add($sid, $room)]);
                    $newActiveSids[] = $sid;
                }
            }

            foreach ($activeSids as $sid) {
                $sidProvider->deactivate($sid);
                $this->withServer($this->serverIds[0], fn () => $adapter->del($sid));
            }
            $activeSids = $newActiveSids;
            $this->withServer($this->serverIds[0], fn () => $adapter->cleanUpLocalOrphanSidsOnce());
        }

        gc_collect_cycles();
        $stats = $this->localStats($adapter);
        self::assertSame($userCount * $tabsPerUser, $stats['sid_count']);
        self::assertSame($userCount + $userCount * $tabsPerUser, $stats['room_count']);
        self::assertSame($userCount * $tabsPerUser * 2, $stats['edge_count']);
        self::assertLessThanOrEqual($userCount + 4, $this->knownExistingKeyCount($rooms, [$this->serverIds[0]]));
        self::assertSame($userCount, $this->nativeRedis->hLen($this->nodeRoomSidsKey($this->nodeId($this->serverIds[0]))));
        self::assertSame($userCount * $tabsPerUser, $this->nativeRedis->hLen($this->nodeSidRoomsKey($this->nodeId($this->serverIds[0]))));
        self::assertLessThan($memoryBefore + 128 * 1024 * 1024, memory_get_usage(false));

        foreach ($activeSids as $sid) {
            $sidProvider->deactivate($sid);
        }
        $this->withServer($this->serverIds[0], fn () => $adapter->cleanUpLocalOrphanSidsOnce());

        self::assertSame(['sid_count' => 0, 'room_count' => 0, 'edge_count' => 0], $this->localStats($adapter));
        self::assertLessThanOrEqual(1, $this->knownExistingKeyCount($rooms, [$this->serverIds[0]]));
        self::assertSame(0, $redis->callCount('scan'));
    }

    /**
     * @return array{RedisAdapter, RedisAdapterV3NativeRedisProxy, RedisAdapterV3NativeRedisProxy, RedisAdapterV3TestSender, RedisAdapterV3TestSidProvider}
     */
    private function makeAdapter(?RedisAdapterV3NativeRedisProxy $redis = null, ?RedisAdapterV3NativeRedisProxy $queueRedis = null): array
    {
        $redis ??= new RedisAdapterV3NativeRedisProxy($this->nativeRedis);
        $queueRedis ??= $redis;
        $redisFactory = Mockery::mock(RedisFactory::class);
        $redisFactory->shouldReceive('get')->with('default')->andReturn($redis);
        $redisFactory->shouldReceive('get')->with('socketio_queue')->andReturn($queueRedis);

        $sender = new RedisAdapterV3TestSender();
        $sidProvider = new RedisAdapterV3TestSidProvider();
        $adapter = new RedisAdapter($redisFactory, $sender, new RedisAdapterV3TestNamespace($this->namespace), $sidProvider);
        return [$adapter, $redis, $queueRedis, $sender, $sidProvider];
    }

    private function connectRedis(): Redis
    {
        $redis = new Redis();
        $host = (string) (getenv('REDIS_HOST') ?: 'localhost');
        $port = (int) (getenv('REDIS_PORT') ?: 6379);
        if (! @$redis->connect($host, $port, 1.5)) {
            self::markTestSkipped(sprintf('Cannot connect local Redis at %s:%d.', $host, $port));
        }
        $auth = (string) getenv('REDIS_AUTH');
        if ($auth !== '' && $auth !== '(null)' && ! $redis->auth($auth)) {
            self::markTestSkipped('Cannot authenticate local Redis.');
        }
        $redis->select((int) (getenv('REDIS_DB') ?: 0));
        return $redis;
    }

    /**
     * @param string[] $rooms
     * @param string[] $serverIds
     * @return string[]
     */
    private function buildKnownKeys(array $rooms, array $serverIds): array
    {
        $keys = [];
        foreach ($rooms as $room) {
            $keys[] = $this->roomNodesKey($room);
        }
        foreach ($serverIds as $serverId) {
            $nodeId = $this->nodeId($serverId);
            $keys[] = $this->nodeRoomSidsKey($nodeId);
            $keys[] = $this->nodeSidRoomsKey($nodeId);
            $keys[] = $this->nodesKeyForNode($nodeId);
            for ($lane = 0; $lane < 4; ++$lane) {
                $keys[] = $this->nodeQueueKey($nodeId, $lane);
            }
            $keys[] = $this->cleanupLockKeyForNode($nodeId);
        }
        return array_values(array_unique($keys));
    }

    /**
     * @return string[]
     */
    private function buildCleanupLockKeys(): array
    {
        $keys = [];
        for ($bucket = 0; $bucket < 128; ++$bucket) {
            $keys[] = self::PREFIX . ':cleanup_lock:' . $bucket;
        }
        return $keys;
    }

    /**
     * @param string[] $keys
     */
    private function cleanupExactKeys(array $keys): void
    {
        foreach (array_chunk(array_values(array_unique($keys)), 500) as $chunk) {
            if ($chunk !== []) {
                $this->nativeRedis->del($chunk);
            }
        }
    }

    /**
     * @param string[] $rooms
     * @param string[] $serverIds
     */
    private function knownExistingKeyCount(array $rooms, array $serverIds): int
    {
        $count = 0;
        foreach ($this->buildKnownKeys($rooms, $serverIds) as $key) {
            $count += (int) $this->nativeRedis->exists($key);
        }
        return $count;
    }

    private function popFirstQueuePayload(string $nodeId): ?string
    {
        for ($lane = 0; $lane < 4; ++$lane) {
            $payload = $this->nativeRedis->rPop($this->nodeQueueKey($nodeId, $lane));
            if (is_string($payload)) {
                return $payload;
            }
        }
        return null;
    }

    private function handleQueuePayload(RedisAdapter $adapter, string $payload): void
    {
        $method = new ReflectionMethod(RedisAdapter::class, 'handleQueuePayload');
        $method->setAccessible(true);
        $method->invoke($adapter, $payload);
    }

    private function refreshQueueLeaseIfDue(RedisAdapter $adapter, string $queueKey, int $lane): void
    {
        $method = new ReflectionMethod(RedisAdapter::class, 'refreshQueueLeaseIfDue');
        $method->setAccessible(true);
        $method->invoke($adapter, $queueKey, $lane);
    }

    /**
     * @return array{sid_count: int, room_count: int, edge_count: int}
     */
    private function localStats(RedisAdapter $adapter): array
    {
        $sidRooms = $this->privateProperty($adapter, 'sidRooms');
        $roomSids = $this->privateProperty($adapter, 'roomSids');
        $edgeCount = 0;
        foreach ($roomSids as $sids) {
            $edgeCount += count($sids);
        }
        return [
            'sid_count' => count($sidRooms),
            'room_count' => count($roomSids),
            'edge_count' => $edgeCount,
        ];
    }

    private function privateProperty(object $object, string $property): mixed
    {
        $reflectionProperty = new ReflectionProperty($object, $property);
        $reflectionProperty->setAccessible(true);
        return $reflectionProperty->getValue($object);
    }

    private function setPrivateProperty(object $object, string $property, mixed $value): void
    {
        $reflectionProperty = new ReflectionProperty($object, $property);
        $reflectionProperty->setAccessible(true);
        $reflectionProperty->setValue($object, $value);
    }

    private function withServer(string $serverId, callable $callback): mixed
    {
        $previous = SocketIO::$serverId;
        SocketIO::$serverId = $serverId;
        try {
            return $callback();
        } finally {
            SocketIO::$serverId = $previous;
        }
    }

    private function sid(string $serverId, int $seq): string
    {
        return DistributedSidCodec::buildSid($serverId, $this->pid(), $seq);
    }

    private function nodeId(string $serverId): string
    {
        return DistributedSidCodec::buildNodeId($serverId, $this->pid());
    }

    private function pid(): int
    {
        $pid = getmypid();
        return $pid === false ? 0 : $pid;
    }

    private function roomNodesKey(string $room): string
    {
        return self::PREFIX . ':room_nodes:' . sha1($this->namespace) . ':' . sha1($room);
    }

    private function nodeRoomSidsKey(string $nodeId): string
    {
        return self::PREFIX . ':node_room_sids:' . sha1($this->namespace) . ':' . $nodeId;
    }

    private function nodeSidRoomsKey(string $nodeId): string
    {
        return self::PREFIX . ':node_sid_rooms:' . sha1($this->namespace) . ':' . $nodeId;
    }

    private function nodeQueueKey(string $nodeId, int $lane): string
    {
        return self::PREFIX . ':node_queue:' . sha1($this->namespace) . ':' . $nodeId . ':' . $lane;
    }

    private function nodesKeyForNode(string $nodeId): string
    {
        return self::PREFIX . ':nodes:' . (sprintf('%u', crc32($nodeId)) % 128);
    }

    private function cleanupLockKeyForNode(string $nodeId): string
    {
        return self::PREFIX . ':cleanup_lock:' . (sprintf('%u', crc32($nodeId)) % 128);
    }

    private function assertRedisKeyHasTtl(string $key, int $maxTtlSeconds): void
    {
        $ttl = (int) $this->nativeRedis->ttl($key);
        self::assertGreaterThan(0, $ttl, 'Redis key must exist with ttl: ' . $key);
        self::assertLessThanOrEqual($maxTtlSeconds, $ttl, 'Redis key ttl is too long: ' . $key);
    }

    private function assertAnyQueueLaneHasTtl(string $nodeId, int $maxTtlSeconds): void
    {
        $ttls = [];
        for ($lane = 0; $lane < 4; ++$lane) {
            $key = $this->nodeQueueKey($nodeId, $lane);
            $ttl = (int) $this->nativeRedis->ttl($key);
            $ttls[$key] = $ttl;
            if ($ttl > 0) {
                self::assertLessThanOrEqual($maxTtlSeconds, $ttl, 'Redis queue key ttl is too long: ' . $key);
                return;
            }
        }

        self::fail('Expected one queue lane with ttl, got: ' . json_encode($ttls, JSON_THROW_ON_ERROR));
    }

    private function setEnv(string $name, string $value): void
    {
        putenv($name . '=' . $value);
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

final class RedisAdapterV3NativeRedisProxy extends RedisProxy
{
    /**
     * @var array<string, int>
     */
    private array $calls = [];

    public function __construct(private Redis $redis)
    {
    }

    public function __call($name, $arguments)
    {
        $this->record($name);
        return $this->redis->{$name}(...$arguments);
    }

    public function pipeline(?callable $callback = null)
    {
        $this->record('pipeline');
        $pipeline = new RedisAdapterV3NativeRedisPipeline($this, $this->redis);
        if ($callback !== null) {
            $callback($pipeline);
            return $pipeline->exec();
        }
        return $pipeline;
    }

    public function callCount(string $method): int
    {
        return $this->calls[$method] ?? 0;
    }

    public function resetCallCounts(): void
    {
        $this->calls = [];
    }

    public function record(string $method): void
    {
        $this->calls[$method] = ($this->calls[$method] ?? 0) + 1;
    }
}

final class RedisAdapterV3NativeRedisPipeline
{
    private bool $executed = false;

    public function __construct(private RedisAdapterV3NativeRedisProxy $proxy, private Redis $redis)
    {
        $this->redis->multi(Redis::PIPELINE);
    }

    public function __call(string $method, array $arguments): self
    {
        $this->proxy->record($method);
        $this->redis->{$method}(...$arguments);
        return $this;
    }

    public function exec(): array
    {
        if ($this->executed) {
            return [];
        }
        $this->executed = true;
        $result = $this->redis->exec();
        return is_array($result) ? $result : [];
    }
}

final class RedisAdapterV3TestSender extends Sender
{
    /**
     * @var array<int, array{int, string}>
     */
    public array $pushes = [];

    /**
     * @var int[]
     */
    public array $disconnects = [];

    public function __construct()
    {
    }

    public function __call($name, $arguments)
    {
        if ($name === 'disconnect') {
            $this->disconnects[] = (int) $arguments[0];
            return true;
        }
        throw new RuntimeException('unsupported sender method ' . $name);
    }

    public function pushFrame(int $fd, FrameInterface $frame): bool
    {
        $this->pushes[] = [$fd, (string) $frame->getPayloadData()];
        return true;
    }
}

final class RedisAdapterV3TestSidProvider implements SidProviderInterface
{
    /**
     * @var array<string, int>
     */
    private array $sidToFd = [];

    public function activate(string $sid, int $fd): void
    {
        $this->sidToFd[$sid] = $fd;
    }

    public function deactivate(string $sid): void
    {
        unset($this->sidToFd[$sid]);
    }

    public function getSid(int $fd): string
    {
        foreach ($this->sidToFd as $sid => $knownFd) {
            if ($knownFd === $fd) {
                return $sid;
            }
        }
        return '';
    }

    public function isLocal(string $sid): bool
    {
        return isset($this->sidToFd[$sid]);
    }

    public function getFd(string $sid): int
    {
        return $this->sidToFd[$sid] ?? -1;
    }
}

final class RedisAdapterV3TestNamespace implements NamespaceInterface
{
    public function __construct(private string $namespace)
    {
    }

    public function getEventHandlers()
    {
        return [];
    }

    public function getNamespace(): string
    {
        return $this->namespace;
    }

    public function getAdapter(): AdapterInterface
    {
        throw new RuntimeException('not used in RedisAdapterV3Test');
    }
}
