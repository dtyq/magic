<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use ArrayObject;
use Hyperf\Context\ApplicationContext;
use Hyperf\Engine\WebSocket\Frame;
use Hyperf\Redis\RedisFactory;
use Hyperf\SocketIOServer\NamespaceInterface;
use Hyperf\SocketIOServer\Room\RedisAdapter;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\SocketIOServer\SocketIO;
use Hyperf\WebSocketServer\Sender;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;
use Redis;
use ReflectionMethod;
use ReflectionProperty;
use Throwable;

/**
 * @internal
 */
class RedisAdapterRealRedisIntegrationTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    private Redis $redis;

    private string $namespace;

    /**
     * @var string[]
     */
    private array $serverIds = [];

    /**
     * @var string[]
     */
    private array $rooms = [];

    /**
     * @var string[]
     */
    private array $sids = [];

    protected function setUp(): void
    {
        parent::setUp();
        if ((string) getenv('SOCKETIO_REAL_REDIS_TEST') !== '1') {
            self::markTestSkipped('Set SOCKETIO_REAL_REDIS_TEST=1 to run the real Redis integration test.');
        }

        putenv('SOCKETIO_INDEX_TTL_SECONDS=60');
        $_ENV['SOCKETIO_INDEX_TTL_SECONDS'] = '60';
        $_SERVER['SOCKETIO_INDEX_TTL_SECONDS'] = '60';
        putenv('SOCKETIO_QUEUE_TTL_SECONDS=30');
        $_ENV['SOCKETIO_QUEUE_TTL_SECONDS'] = '30';
        $_SERVER['SOCKETIO_QUEUE_TTL_SECONDS'] = '30';

        $this->redis = $this->connectRedis();
        $suffix = bin2hex(random_bytes(4));
        $this->namespace = '/socketio-real-it-' . $suffix;
        $this->serverIds = [
            'pod-a-' . $suffix,
            'pod-b-' . $suffix,
            'pod-c-' . $suffix,
            'pod-dead-' . $suffix,
        ];
        $this->rooms = [
            (string) random_int(100000000000000000, 899999999999999999),
            'user:2002:' . $suffix,
            'stale-room:' . $suffix,
        ];
        $this->sids = [
            $this->serverIds[0] . '#1',
            $this->serverIds[0] . '#2',
            $this->serverIds[1] . '#1',
            $this->serverIds[2] . '#1',
            $this->serverIds[3] . '#1',
        ];

        $this->cleanupExactKeys();
    }

    protected function tearDown(): void
    {
        try {
            $this->cleanupExactKeys();
        } catch (Throwable) {
        }
        SocketIO::$serverId = '';
        parent::tearDown();
    }

    public function testUserRoomRouteQueueTtlReconcileAndCleanupWorkTogether(): void
    {
        $nodeA = $this->nodeId($this->serverIds[0]);
        $nodeB = $this->nodeId($this->serverIds[1]);
        $nodeDead = $this->nodeId($this->serverIds[3]);

        [$podA, $pushesA] = $this->makeAdapter($this->serverIds[0], [
            $this->sids[0] => 101,
            $this->sids[1] => 102,
        ]);
        [$podB, $pushesB] = $this->makeAdapter($this->serverIds[1], [
            $this->sids[2] => 201,
        ]);
        [$podC] = $this->makeAdapter($this->serverIds[2], [
            $this->sids[3] => 301,
        ]);

        $this->withServer($this->serverIds[0], fn () => $podA->add($this->sids[0], $this->rooms[0]));
        $this->withServer($this->serverIds[0], fn () => $podA->add($this->sids[1], $this->rooms[0]));
        $this->withServer($this->serverIds[1], fn () => $podB->add($this->sids[2], $this->rooms[0]));
        $this->withServer($this->serverIds[2], fn () => $podC->add($this->sids[3], $this->rooms[1]));

        self::assertEqualsCanonicalizing(
            [$nodeA, $nodeB],
            $this->redisSetMembers($this->roomNodesKey($this->rooms[0]))
        );
        self::assertEqualsCanonicalizing(
            [$this->sids[0], $this->sids[1]],
            $this->redisSetMembers($this->nodeRoomSidsKey($nodeA, $this->rooms[0]))
        );
        self::assertSame([$this->sids[2]], $this->redisSetMembers($this->nodeRoomSidsKey($nodeB, $this->rooms[0])));
        $this->assertKeyHasTtl($this->roomNodesKey($this->rooms[0]));
        $this->assertKeyHasTtl($this->nodeRoomsKey($nodeA));
        $this->assertKeyHasTtl($this->nodeSidsKey($nodeA));
        $this->assertKeyHasTtl($this->nodeRoomSidsKey($nodeA, $this->rooms[0]));
        $this->assertKeyHasTtl($this->sidRoomsKey($this->sids[0]));
        $this->assertKeyHasTtl($this->sidNodeKey($this->sids[0]));
        $this->assertKeyHasTtl($this->nodesKey($this->nodeBucket($nodeA)));

        $this->withServer($this->serverIds[0], fn () => $podA->broadcast('packet-user-1001', ['rooms' => [$this->rooms[0]]]));
        self::assertSame([
            [$this->serverIds[0], 101, 'packet-user-1001'],
            [$this->serverIds[0], 102, 'packet-user-1001'],
        ], $pushesA->getArrayCopy());

        $queueKey = $this->nodeQueueKey($nodeB, $this->laneForRoom($this->rooms[0]));
        $this->assertKeyHasTtl($queueKey);
        $payload = $this->redis->rPop($queueKey);
        self::assertIsString($payload);
        self::assertSame('packet-user-1001', $this->payloadPacket($payload));

        $this->withServer($this->serverIds[1], fn () => $this->handleQueuePayload($podB, $payload));
        self::assertSame([
            [$this->serverIds[1], 201, 'packet-user-1001'],
        ], $pushesB->getArrayCopy());

        $this->withServer($this->serverIds[1], fn () => $podB->del($this->sids[2], $this->rooms[0]));
        self::assertSame([$nodeA], $this->redisSetMembers($this->roomNodesKey($this->rooms[0])));
        self::assertFalse((bool) $this->redis->exists($this->nodeRoomSidsKey($nodeB, $this->rooms[0])));

        $this->redis->del($this->roomNodesKey($this->rooms[0]));
        $this->redis->del($this->nodeRoomSidsKey($nodeA, $this->rooms[0]));
        $this->redis->sAdd($this->nodeRoomsKey($nodeA), $this->hashValue($this->rooms[2]));
        $this->redis->sAdd($this->roomNodesKey($this->rooms[2]), $nodeA);
        $this->redis->sAdd($this->nodeRoomSidsKey($nodeA, $this->rooms[2]), $this->sids[0]);

        $this->withServer($this->serverIds[0], fn () => $podA->reconcileRouteIndex());
        self::assertSame([$nodeA], $this->redisSetMembers($this->roomNodesKey($this->rooms[0])));
        self::assertEqualsCanonicalizing(
            [$this->sids[0], $this->sids[1]],
            $this->redisSetMembers($this->nodeRoomSidsKey($nodeA, $this->rooms[0]))
        );
        self::assertSame([], $this->redisSetMembers($this->roomNodesKey($this->rooms[2])));
        self::assertFalse((bool) $this->redis->exists($this->nodeRoomSidsKey($nodeA, $this->rooms[2])));
        $this->assertKeyHasTtl($this->roomNodesKey($this->rooms[0]));

        $this->prepareDeadNodeIndexes();
        $this->withServer($this->serverIds[0], fn () => $podA->cleanUpNode($nodeDead));
        self::assertNotContains($nodeDead, $this->redisSetMembers($this->roomNodesKey($this->rooms[0])));
        self::assertFalse((bool) $this->redis->exists($this->nodeRoomsKey($nodeDead)));
        self::assertFalse((bool) $this->redis->exists($this->nodeSidsKey($nodeDead)));
        self::assertFalse((bool) $this->redis->exists($this->nodeQueueKey($nodeDead, $this->laneForRoom($this->rooms[0]))));
    }

    /**
     * @param array<string, int> $fdMap
     * @return array{RedisAdapter, ArrayObject<int, array{string, int, string}>}
     */
    private function makeAdapter(string $serverId, array $fdMap): array
    {
        /** @var ArrayObject<int, array{string, int, string}> $pushes */
        $pushes = new ArrayObject();
        $sender = Mockery::mock(Sender::class);
        $sender->shouldReceive('pushFrame')
            ->byDefault()
            ->andReturnUsing(function (int $fd, Frame $frame) use ($pushes, $serverId): bool {
                $pushes->append([$serverId, $fd, (string) $frame->getPayloadData()]);
                return true;
            });
        $sender->shouldReceive('disconnect')->byDefault()->andReturn(true);

        $namespace = Mockery::mock(NamespaceInterface::class);
        $namespace->shouldReceive('getNamespace')->byDefault()->andReturn($this->namespace);

        $sidProvider = Mockery::mock(SidProviderInterface::class);
        $sidProvider->shouldReceive('isLocal')
            ->byDefault()
            ->andReturnUsing(static fn (string $sid): bool => isset($fdMap[$sid]));
        $sidProvider->shouldReceive('getFd')
            ->byDefault()
            ->andReturnUsing(static fn (string $sid): int => $fdMap[$sid] ?? 0);

        $adapter = new RedisAdapter(
            ApplicationContext::getContainer()->get(RedisFactory::class),
            $sender,
            $namespace,
            $sidProvider
        );
        $this->setPrivateProperty($adapter, 'messageContentProvider', null);

        return [$adapter, $pushes];
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

    private function handleQueuePayload(RedisAdapter $adapter, string $payload): void
    {
        $method = new ReflectionMethod(RedisAdapter::class, 'handleQueuePayload');
        $method->setAccessible(true);
        $method->invoke($adapter, $payload);
    }

    private function prepareDeadNodeIndexes(): void
    {
        $nodeId = $this->nodeId($this->serverIds[3]);
        $roomHash = $this->hashValue($this->rooms[0]);
        $sid = $this->sids[4];
        $lane = $this->laneForRoom($this->rooms[0]);

        $this->redis->sAdd($this->roomNodesKey($this->rooms[0]), $nodeId);
        $this->redis->sAdd($this->nodeRoomsKey($nodeId), $roomHash);
        $this->redis->sAdd($this->nodeSidsKey($nodeId), $sid);
        $this->redis->sAdd($this->nodeRoomSidsKey($nodeId, $this->rooms[0]), $sid);
        $this->redis->sAdd($this->sidRoomsKey($sid), $this->rooms[0]);
        $this->redis->set($this->sidNodeKey($sid), $nodeId);
        $this->redis->lPush($this->nodeQueueKey($nodeId, $lane), 'dead-payload');
        $this->redis->zAdd($this->nodesKey($this->nodeBucket($nodeId)), time() * 1000 - 60000, $nodeId);
    }

    private function cleanupExactKeys(): void
    {
        if (! isset($this->redis)) {
            return;
        }

        foreach ($this->rooms as $room) {
            $this->redis->del($this->roomNodesKey($room));
        }
        foreach ($this->serverIds as $serverId) {
            $nodeId = $this->nodeId($serverId);
            foreach ([$serverId, $nodeId] as $routeId) {
                $this->redis->del($this->nodeRoomsKey($routeId));
                $this->redis->del($this->nodeSidsKey($routeId));
                $this->redis->zRem($this->nodesKey($this->nodeBucket($routeId)), $routeId);
                foreach ($this->rooms as $room) {
                    $this->redis->del($this->nodeRoomSidsKey($routeId, $room));
                }
                for ($lane = 0; $lane < 8; ++$lane) {
                    $this->redis->del($this->nodeQueueKey($routeId, $lane));
                }
            }
        }
        foreach ($this->sids as $sid) {
            $this->redis->del($this->sidRoomsKey($sid));
            $this->redis->del($this->sidNodeKey($sid));
        }
    }

    private function connectRedis(): Redis
    {
        if (! extension_loaded('redis')) {
            self::markTestSkipped('phpredis extension is required.');
        }

        $redis = new Redis();
        $host = (string) (getenv('SOCKETIO_REDIS_HOST') ?: getenv('REDIS_HOST') ?: 'localhost');
        $port = (int) (getenv('SOCKETIO_REDIS_PORT') ?: getenv('REDIS_PORT') ?: 6379);
        if (! $redis->connect($host, $port, 1.0)) {
            self::markTestSkipped(sprintf('Redis %s:%d is not reachable.', $host, $port));
        }

        $auth = (string) (getenv('SOCKETIO_REDIS_AUTH') ?: getenv('REDIS_AUTH') ?: '');
        if ($auth !== '' && $auth !== '(null)' && ! $redis->auth($auth)) {
            self::markTestSkipped('Redis auth failed.');
        }

        $db = (int) (getenv('SOCKETIO_REDIS_DB') ?: getenv('REDIS_DB') ?: 0);
        $redis->select($db);
        return $redis;
    }

    private function assertKeyHasTtl(string $key): void
    {
        self::assertTrue((bool) $this->redis->exists($key), sprintf('Redis key does not exist: %s', $key));
        self::assertGreaterThan(0, $this->redis->ttl($key), sprintf('Redis key has no TTL: %s', $key));
    }

    /**
     * @return string[]
     */
    private function redisSetMembers(string $key): array
    {
        $members = array_map('strval', (array) $this->redis->sMembers($key));
        sort($members);
        return $members;
    }

    private function roomNodesKey(string $room): string
    {
        $roomHash = $this->hashValue($room);
        $namespaceHash = $this->hashValue($this->namespace);
        return implode(':', [
            'magicChat:SocketIo:RedisAdapter:v2',
            $this->clusterRouteTag('room_nodes:' . $namespaceHash . ':' . $roomHash),
            'room_nodes',
            $namespaceHash,
            $roomHash,
        ]);
    }

    private function nodeRoomsKey(string $nodeId): string
    {
        $namespaceHash = $this->hashValue($this->namespace);
        return implode(':', [
            'magicChat:SocketIo:RedisAdapter:v2',
            $this->clusterRouteTag('node:' . $namespaceHash . ':' . $nodeId),
            'node_rooms',
            $namespaceHash,
            $nodeId,
        ]);
    }

    private function nodeSidsKey(string $nodeId): string
    {
        $namespaceHash = $this->hashValue($this->namespace);
        return implode(':', [
            'magicChat:SocketIo:RedisAdapter:v2',
            $this->clusterRouteTag('node:' . $namespaceHash . ':' . $nodeId),
            'node_sids',
            $namespaceHash,
            $nodeId,
        ]);
    }

    private function nodeRoomSidsKey(string $nodeId, string $room): string
    {
        $namespaceHash = $this->hashValue($this->namespace);
        $roomHash = $this->hashValue($room);
        return implode(':', [
            'magicChat:SocketIo:RedisAdapter:v2',
            $this->clusterRouteTag('node_room_sids:' . $namespaceHash . ':' . $nodeId . ':' . $roomHash),
            'node_room_sids',
            $namespaceHash,
            $nodeId,
            $roomHash,
        ]);
    }

    private function sidRoomsKey(string $sid): string
    {
        $namespaceHash = $this->hashValue($this->namespace);
        $sidHash = $this->hashValue($sid);
        return implode(':', [
            'magicChat:SocketIo:RedisAdapter:v2',
            $this->clusterRouteTag('sid:' . $namespaceHash . ':' . $sidHash),
            'sid_rooms',
            $namespaceHash,
            $sidHash,
        ]);
    }

    private function sidNodeKey(string $sid): string
    {
        $namespaceHash = $this->hashValue($this->namespace);
        $sidHash = $this->hashValue($sid);
        return implode(':', [
            'magicChat:SocketIo:RedisAdapter:v2',
            $this->clusterRouteTag('sid:' . $namespaceHash . ':' . $sidHash),
            'sid_node',
            $namespaceHash,
            $sidHash,
        ]);
    }

    private function nodesKey(int $bucket): string
    {
        return implode(':', [
            'magicChat:SocketIo:RedisAdapter:v2',
            $this->clusterRouteTag('nodes:' . $bucket),
            'nodes',
            (string) $bucket,
        ]);
    }

    private function nodeQueueKey(string $nodeId, int $lane): string
    {
        $namespaceHash = $this->hashValue($this->namespace);
        return implode(':', [
            'magicChat:SocketIo:RedisAdapter:v2',
            $this->clusterRouteTag('node_queue:' . $namespaceHash . ':' . $nodeId . ':' . $lane),
            'node_queue',
            $namespaceHash,
            $nodeId,
            (string) $lane,
        ]);
    }

    private function nodeBucket(string $nodeId): int
    {
        return sprintf('%u', crc32($nodeId)) % 128;
    }

    private function laneForRoom(string $room): int
    {
        return sprintf('%u', crc32($this->hashValue($room))) % 8;
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

    private function setPrivateProperty(object $object, string $property, mixed $value): void
    {
        $reflectionProperty = new ReflectionProperty($object, $property);
        $reflectionProperty->setAccessible(true);
        $reflectionProperty->setValue($object, $value);
    }
}
