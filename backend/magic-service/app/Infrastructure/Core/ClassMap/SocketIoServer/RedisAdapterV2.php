<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\SocketIOServer\Room;

use App\Domain\Chat\Service\MessageContentProviderInterface;
use App\Infrastructure\Core\Traits\HasLogger;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Coordinator\Constants;
use Hyperf\Coordinator\CoordinatorManager;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Engine\WebSocket\Frame;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Hyperf\SocketIOServer\NamespaceInterface;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\SocketIOServer\SocketIO;
use Hyperf\WebSocketServer\Sender;
use Redis;
use Throwable;

use function Hyperf\Collection\data_get;
use function Hyperf\Support\env;
use function Hyperf\Support\retry;

/**
 * Socket.IO Redis Adapter v2.
 *
 * v1 的主要压力不在 pub/sub 本身，而是在热点 room / 全量广播路径上反复读大 Set / ZSet：
 * - room 广播会高频 SMEMBERS room => sids，热点房间会把单 key 打满；
 * - 全量 clients / 过期清理会高频扫 stat / expire，ZRangeByScore 容易集中到少数 key；
 * - pub/sub QPS 相对较低，直接替换为队列并不能解决这些索引热 key。
 *
 * v2 改成“本地内存索引 + Redis 轻量路由索引 + 按节点队列”：
 * - 本节点推送只查本地 roomSids，避免每次广播都从 Redis 拉大 sid set；
 * - Redis 只保存 room=>node、node=>room/sid、node+room=>sid 这类较小索引；
 * - 跨节点消息写到目标 node queue，消费者只在本进程内做本地 fan-out。
 *
 * Redis key 使用高基数 cluster route tag，避免把整个 Socket.IO namespace 固定到单个 slot，
 * 让 Redis Cluster 可以按 room / node / sid / bucket / lane 自动分散到多个 master。
 */
class RedisAdapter implements AdapterInterface, EphemeralInterface
{
    use HasLogger;

    private const int ENVELOPE_VERSION = 1;

    protected string $redisPrefix = 'magicChat:SocketIo:RedisAdapter:v2';

    protected int $retryInterval = 1000;

    protected int $nodeHeartbeatIntervalMs = 5000;

    protected int $nodeExpireMs = 30000;

    protected int $nodeCleanupIntervalMs = 30000;

    protected int $nodeReconcileIntervalMs = 15000;

    protected int $activeNodeCacheTtlMs = 1000;

    protected int $nodeCleanupBatchSize = 200;

    protected int $nodeBucketCount = 128;

    protected int $queueLaneCount = 8;

    protected int $queueMaxLength = 10000;

    protected int $queueTtlSeconds = 60;

    protected int $queuePopTimeoutSeconds = 2;

    protected int $indexTtlSeconds = 86400;

    protected string $connection = 'default';

    protected string $queueConnection = 'socketio_queue';

    protected \Hyperf\Redis\Redis|Redis|RedisProxy $redis;

    protected \Hyperf\Redis\Redis|Redis|RedisProxy $queueRedis;

    protected int $ttl = 0;

    protected ?MessageContentProviderInterface $messageContentProvider = null;

    /**
     * Local room key => sid set.
     *
     * @var array<string, array<string, true>>
     */
    private array $roomSids = [];

    /**
     * Sid => local room key => original room.
     *
     * @var array<string, array<string, string>>
     */
    private array $sidRooms = [];

    /**
     * Local room key => local sid count.
     *
     * @var array<string, int>
     */
    private array $roomLocalCount = [];

    private bool $queueConsumersStarted = false;

    private bool $maintenanceStarted = false;

    /**
     * @var string[]
     */
    private array $activeNodeIdsCache = [];

    private int $activeNodeIdsCacheExpiresAtMs = 0;

    public function __construct(
        RedisFactory $redis,
        protected Sender $sender,
        protected NamespaceInterface $nsp,
        protected SidProviderInterface $sidProvider
    ) {
        $this->loadRuntimeConfig();
        $this->redis = $redis->get($this->connection);
        try {
            $this->queueRedis = $redis->get($this->queueConnection);
        } catch (Throwable) {
            $this->queueRedis = $this->redis;
        }

        try {
            $container = ApplicationContext::getContainer();
            if ($container->has(MessageContentProviderInterface::class)) {
                $this->messageContentProvider = $container->get(MessageContentProviderInterface::class);
            }
        } catch (Throwable) {
        }
    }

    public function add(string $sid, string ...$rooms): void
    {
        if ($sid === '' || empty($rooms)) {
            return;
        }

        $this->refreshNodeHeartbeat();
        $normalizedRooms = $this->normalizeRooms($rooms);
        if ($normalizedRooms === []) {
            return;
        }

        /** @var array<int, array{room: string, room_key: string, room_was_empty: bool}> $changes */
        $changes = [];
        foreach ($normalizedRooms as $room) {
            $roomKey = $this->getLocalRoomKey($room);
            if (isset($this->sidRooms[$sid][$roomKey])) {
                continue;
            }

            $changes[] = [
                'room' => $room,
                'room_key' => $roomKey,
                'room_was_empty' => empty($this->roomSids[$roomKey]),
            ];
        }

        if ($changes === []) {
            return;
        }

        $sidWasKnown = isset($this->sidRooms[$sid]);
        try {
            // 先写 Redis 路由索引，成功后再更新本地内存索引。
            // 如果 Redis 写失败，本 worker 不会产生“本地可见但跨节点不可达”的半注册连接。
            foreach ($changes as $change) {
                $room = $change['room'];
                $roomHash = $this->hashValue($room);
                if ($change['room_was_empty']) {
                    $this->registerRoomNode($roomHash);
                }
                $this->registerSidRoom($sid, $room, $roomHash);
            }
            if (! $sidWasKnown) {
                $this->registerNodeSid($sid);
            }
        } catch (Throwable $throwable) {
            $this->logger->error(sprintf(
                'socketioRouteIndex event=addFailed namespace=%s sid=%s rooms=%s error=%s',
                $this->nsp->getNamespace(),
                $sid,
                implode(',', array_column($changes, 'room')),
                $this->formatThrowable($throwable)
            ));
            throw $throwable;
        }

        foreach ($changes as $change) {
            $room = $change['room'];
            $roomKey = $change['room_key'];
            $this->sidRooms[$sid][$roomKey] = $room;
            $this->roomSids[$roomKey][$sid] = true;
            $this->roomLocalCount[$roomKey] = ($this->roomLocalCount[$roomKey] ?? 0) + 1;
        }
    }

    public function reconcileRouteIndex(): void
    {
        $this->refreshNodeHeartbeat();
        $nodeId = $this->getNodeId();
        $nodeRoomsKey = $this->getNodeRoomsKey($nodeId);

        // 对账只基于本 worker 的内存索引与 node_rooms 小集合，不做 prefix scan。
        // 它用于修复短暂 Redis 写失败、TTL 续期遗漏、异常断连等造成的轻微索引漂移。
        $localRoomHashes = [];
        foreach (array_keys($this->roomSids) as $roomKey) {
            $room = $this->getRoomFromLocalKey((string) $roomKey);
            $roomHash = $this->hashValue($room);
            $localRoomHashes[$roomHash] = $roomHash;
        }

        $staleRoomHashes = [];
        foreach ((array) $this->redis->sMembers($nodeRoomsKey) as $knownRoomHash) {
            $knownRoomHash = (string) $knownRoomHash;
            if (isset($localRoomHashes[$knownRoomHash])) {
                continue;
            }
            $staleRoomHashes[] = $knownRoomHash;
        }

        if (! empty($staleRoomHashes)) {
            $this->pipeline($this->redis, function ($pipeline) use ($nodeId, $staleRoomHashes) {
                foreach ($staleRoomHashes as $knownRoomHash) {
                    $pipeline->sRem($this->getRoomNodesKeyByHash($knownRoomHash), $nodeId);
                    $pipeline->del($this->getNodeRoomSidsKey($nodeId, $knownRoomHash));
                }
            });
        }

        foreach (array_keys($this->roomSids) as $roomKey) {
            $room = $this->getRoomFromLocalKey((string) $roomKey);
            $roomHash = $this->hashValue($room);
            $this->ensureRoomNode($roomHash);
            $this->syncNodeRoomSids($room, $roomHash);
        }
        foreach (array_keys($this->sidRooms) as $sid) {
            $this->syncSidRooms($sid);
        }
        $this->syncNodeSids();
        $this->replaceSet($nodeRoomsKey, array_values($localRoomHashes));
    }

    public function del(string $sid, string ...$rooms): void
    {
        if ($sid === '') {
            return;
        }

        $targetRooms = empty($rooms) ? array_values($this->sidRooms[$sid] ?? []) : $this->normalizeRooms($rooms);
        if ($targetRooms === []) {
            $this->deleteLocalSidIndex($sid);
            return;
        }

        foreach ($targetRooms as $room) {
            $roomKey = $this->getLocalRoomKey($room);
            if (! isset($this->sidRooms[$sid][$roomKey])) {
                continue;
            }

            unset($this->sidRooms[$sid][$roomKey], $this->roomSids[$roomKey][$sid]);
            $roomHash = $this->hashValue($room);
            $this->unregisterSidRoom($sid, $room, $roomHash);

            $this->roomLocalCount[$roomKey] = max(0, ($this->roomLocalCount[$roomKey] ?? 1) - 1);
            if ($this->roomLocalCount[$roomKey] === 0) {
                unset($this->roomLocalCount[$roomKey], $this->roomSids[$roomKey]);
                $this->unregisterRoomNode($roomHash);
            }
        }

        if (empty($this->sidRooms[$sid])) {
            unset($this->sidRooms[$sid]);
            $this->deleteLocalSidIndex($sid);
        }
    }

    public function broadcast($packet, $opts): void
    {
        $opts = is_array($opts) ? $opts : [];
        $rooms = $this->extractRooms($opts);
        if (data_get($opts, 'flag.local', false)) {
            $this->doBroadcast((string) $packet, $opts);
            return;
        }

        $targetNodes = $this->resolveTargetNodes($rooms);
        if ($targetNodes === []) {
            return;
        }

        $currentNodeId = $this->getNodeId();
        $localPushed = false;
        foreach ($targetNodes as $nodeId => $_) {
            if ($nodeId === $currentNodeId) {
                $this->doBroadcast((string) $packet, $opts);
                $localPushed = true;
                continue;
            }
            // 跨节点不再 publish 全局频道，而是写目标 node 的队列。
            // 远端 worker 消费后只查自己的本地 roomSids，避免热点 room 反复 SMEMBERS 大集合。
            $this->pushNodeQueue($nodeId, (string) $packet, $opts, $rooms);
        }

        if (! $localPushed && $this->hasLocalTargets($rooms)) {
            $this->doBroadcast((string) $packet, $opts);
        }
    }

    public function clients(string ...$rooms): array
    {
        $result = [];
        $pushed = [];
        $rooms = $this->normalizeRooms($rooms);

        if ($rooms !== []) {
            foreach ($rooms as $room) {
                foreach (array_keys($this->roomSids[$this->getLocalRoomKey($room)] ?? []) as $sid) {
                    $this->appendUniqueSid($result, $pushed, $sid);
                }

                foreach ($this->getRoomNodeIds($room) as $nodeId) {
                    foreach ((array) $this->redis->sMembers($this->getNodeRoomSidsKey($nodeId, $this->hashValue($room))) as $sid) {
                        $this->appendUniqueSid($result, $pushed, (string) $sid);
                    }
                }
            }
            return $result;
        }

        foreach (array_keys($this->sidRooms) as $sid) {
            $this->appendUniqueSid($result, $pushed, $sid);
        }
        foreach ($this->getActiveNodeIds() as $nodeId) {
            foreach ((array) $this->redis->sMembers($this->getNodeSidsKey($nodeId)) as $sid) {
                $this->appendUniqueSid($result, $pushed, (string) $sid);
            }
        }
        return $result;
    }

    public function clientRooms(string $sid): array
    {
        if (isset($this->sidRooms[$sid])) {
            return array_values($this->sidRooms[$sid]);
        }
        return array_values(array_map('strval', (array) $this->redis->sMembers($this->getSidRoomsKey($sid))));
    }

    public function subscribe()
    {
        if ($this->queueConsumersStarted) {
            return;
        }
        $this->queueConsumersStarted = true;

        for ($lane = 0; $lane < $this->queueLaneCount; ++$lane) {
            Coroutine::create(function () use ($lane) {
                CoordinatorManager::until(Constants::WORKER_START)->yield();
                retry(PHP_INT_MAX, function () use ($lane) {
                    $this->consumeQueueLane($lane);
                }, $this->retryInterval);
            });
        }
    }

    public function cleanUp(): void
    {
        $this->cleanUpNode($this->getNodeId());
    }

    public function cleanUpExpired(): void
    {
        if ($this->maintenanceStarted) {
            return;
        }
        $this->maintenanceStarted = true;

        Coroutine::create(function () {
            $this->runMaintenanceTask('heartbeat', fn () => $this->refreshNodeHeartbeat());
            while (true) {
                if (CoordinatorManager::until(Constants::WORKER_EXIT)->yield($this->nodeHeartbeatIntervalMs / 1000)) {
                    break;
                }
                $this->runMaintenanceTask('heartbeat', fn () => $this->refreshNodeHeartbeat());
            }
        });

        Coroutine::create(function () {
            $this->runMaintenanceTask('reconcile', fn () => $this->reconcileRouteIndex());
            while (true) {
                if (CoordinatorManager::until(Constants::WORKER_EXIT)->yield($this->nodeReconcileIntervalMs / 1000)) {
                    break;
                }
                $this->runMaintenanceTask('reconcile', fn () => $this->reconcileRouteIndex());
            }
        });

        Coroutine::create(function () {
            while (true) {
                if (CoordinatorManager::until(Constants::WORKER_EXIT)->yield($this->nodeCleanupIntervalMs / 1000)) {
                    break;
                }
                $this->runMaintenanceTask('cleanup', fn () => $this->cleanUpExpiredOnce());
            }
        });
    }

    public function cleanUpExpiredOnce(): void
    {
        $cutoff = (string) ($this->nowMs() - $this->nodeExpireMs);
        for ($bucket = 0; $bucket < $this->nodeBucketCount; ++$bucket) {
            if (! $this->acquireCleanupLock($bucket)) {
                continue;
            }

            $nodesKey = $this->getNodesKey($bucket);
            $nodeIds = (array) $this->redis->zRangeByScore($nodesKey, '-inf', $cutoff, [
                'limit' => [0, $this->nodeCleanupBatchSize],
            ]);
            foreach ($nodeIds as $nodeId) {
                $nodeId = (string) $nodeId;
                if ($this->isNodeAlive($nodeId)) {
                    continue;
                }
                $this->cleanUpNode($nodeId);
                $this->activeNodeIdsCacheExpiresAtMs = 0;
            }
        }
    }

    public function setTtl(int $ms): EphemeralInterface
    {
        $this->ttl = $ms;
        return $this;
    }

    public function renew(string $sid): void
    {
        // 连接存活由本进程内存与 node 心跳维护，避免每次 ping 写 Redis zset。
    }

    public function disconnectSid(string $sid): void
    {
        if ($sid === '') {
            return;
        }

        $isLocal = $this->isLocal($sid);
        if ($isLocal) {
            $fd = $this->getFd($sid);
            if ($fd > 0) {
                $this->closeFd($fd, $sid);
            }
        }
        $this->del($sid);
    }

    public function cleanUpNode(string $nodeId): void
    {
        if ($nodeId === '') {
            return;
        }

        $roomHashes = (array) $this->redis->sMembers($this->getNodeRoomsKey($nodeId));
        $sids = (array) $this->redis->sMembers($this->getNodeSidsKey($nodeId));

        $this->pipeline($this->redis, function ($pipeline) use ($nodeId, $roomHashes, $sids) {
            foreach ($roomHashes as $roomHash) {
                $roomHash = (string) $roomHash;
                $pipeline->sRem($this->getRoomNodesKeyByHash($roomHash), $nodeId);
                $pipeline->del($this->getNodeRoomSidsKey($nodeId, $roomHash));
            }

            foreach ($sids as $sid) {
                $sid = (string) $sid;
                $pipeline->del($this->getSidRoomsKey($sid));
                $pipeline->del($this->getSidNodeKey($sid));
            }
            $pipeline->del($this->getNodeRoomsKey($nodeId));
            $pipeline->del($this->getNodeSidsKey($nodeId));
            $pipeline->zRem($this->getNodesKey($this->getNodeBucket($nodeId)), $nodeId);
        });

        $this->pipeline($this->queueRedis, function ($pipeline) use ($nodeId) {
            for ($lane = 0; $lane < $this->queueLaneCount; ++$lane) {
                $pipeline->del($this->getNodeQueueKey($nodeId, $lane));
            }
        });
    }

    protected function doBroadcast(string $packet, array $opts): void
    {
        $rooms = $this->extractRooms($opts);
        $except = data_get($opts, 'except', []);
        $exceptSet = $this->buildExceptSet(is_array($except) ? $except : []);
        $pushed = [];
        $resolvedPacket = null;

        if ($rooms !== []) {
            foreach ($rooms as $room) {
                foreach (array_keys($this->roomSids[$this->getLocalRoomKey($room)] ?? []) as $sid) {
                    $this->tryPush($sid, $packet, $resolvedPacket, $pushed, $opts, $exceptSet);
                }
            }
            return;
        }

        foreach (array_keys($this->sidRooms) as $sid) {
            $this->tryPush($sid, $packet, $resolvedPacket, $pushed, $opts, $exceptSet);
        }
    }

    protected function isLocal(string $sid): bool
    {
        return $this->sidProvider->isLocal($sid);
    }

    protected function getFd(string $sid): int
    {
        return $this->sidProvider->getFd($sid);
    }

    private function syncSidRooms(string $sid): void
    {
        $rooms = array_values($this->sidRooms[$sid] ?? []);
        $key = $this->getSidRoomsKey($sid);
        if ($rooms === []) {
            $sidNodeKey = $this->getSidNodeKey($sid);
            $this->pipeline($this->redis, static function ($pipeline) use ($key, $sidNodeKey) {
                $pipeline->del($key);
                $pipeline->del($sidNodeKey);
            });
            return;
        }
        $this->replaceSet($key, $rooms);
        $this->syncSidNode($sid);
    }

    private function syncNodeSids(): void
    {
        $key = $this->getNodeSidsKey($this->getNodeId());
        $sids = array_keys($this->sidRooms);
        if ($sids === []) {
            $this->pipeline($this->redis, static function ($pipeline) use ($key) {
                $pipeline->del($key);
            });
            return;
        }
        $this->replaceSet($key, $sids);
    }

    private function syncNodeRoomSids(string $room, string $roomHash): void
    {
        $key = $this->getNodeRoomSidsKey($this->getNodeId(), $roomHash);
        $sids = array_keys($this->roomSids[$this->getLocalRoomKey($room)] ?? []);
        if ($sids === []) {
            $this->pipeline($this->redis, static function ($pipeline) use ($key) {
                $pipeline->del($key);
            });
            return;
        }
        $this->replaceSet($key, $sids);
    }

    private function loadRuntimeConfig(): void
    {
        $this->queueConnection = (string) env('SOCKETIO_REDIS_QUEUE_CONNECTION', $this->queueConnection);
        $this->nodeHeartbeatIntervalMs = max(1000, (int) env('SOCKETIO_NODE_HEARTBEAT_MS', $this->nodeHeartbeatIntervalMs));
        $this->nodeExpireMs = max($this->nodeHeartbeatIntervalMs * 2, (int) env('SOCKETIO_NODE_EXPIRE_MS', $this->nodeExpireMs));
        $this->nodeCleanupIntervalMs = max(1000, (int) env('SOCKETIO_NODE_CLEANUP_MS', $this->nodeCleanupIntervalMs));
        $this->nodeReconcileIntervalMs = max($this->nodeHeartbeatIntervalMs, (int) env('SOCKETIO_NODE_RECONCILE_MS', $this->nodeReconcileIntervalMs));
        $this->activeNodeCacheTtlMs = max(0, (int) env('SOCKETIO_ACTIVE_NODE_CACHE_TTL_MS', $this->activeNodeCacheTtlMs));
        $this->nodeBucketCount = max(1, (int) env('SOCKETIO_NODE_BUCKET_COUNT', $this->nodeBucketCount));
        $this->queueLaneCount = max(1, (int) env('SOCKETIO_QUEUE_LANE_COUNT', $this->queueLaneCount));
        $this->queueMaxLength = max(100, (int) env('SOCKETIO_QUEUE_MAX_LENGTH', $this->queueMaxLength));
        $this->queueTtlSeconds = max(10, (int) env('SOCKETIO_QUEUE_TTL_SECONDS', $this->queueTtlSeconds));
        $this->queuePopTimeoutSeconds = max(1, (int) env('SOCKETIO_QUEUE_POP_TIMEOUT_SECONDS', $this->queuePopTimeoutSeconds));
        $this->indexTtlSeconds = max(60, (int) env('SOCKETIO_INDEX_TTL_SECONDS', $this->indexTtlSeconds));
        $this->indexTtlSeconds = max($this->indexTtlSeconds, (int) ceil($this->nodeReconcileIntervalMs / 1000) * 3);
    }

    private function resolveTargetNodes(array $rooms): array
    {
        $targetNodes = [];
        if ($rooms === []) {
            foreach ($this->getActiveNodeIds() as $nodeId) {
                $targetNodes[$nodeId] = true;
            }
            $targetNodes[$this->getNodeId()] = true;
            return $targetNodes;
        }

        foreach ($rooms as $room) {
            foreach ($this->getRoomNodeIds($room) as $nodeId) {
                if ($nodeId === $this->getNodeId() || $this->isNodeAlive($nodeId)) {
                    $targetNodes[$nodeId] = true;
                }
            }
        }
        if ($this->hasLocalTargets($rooms)) {
            $targetNodes[$this->getNodeId()] = true;
        }
        return $targetNodes;
    }

    private function hasLocalTargets(array $rooms): bool
    {
        if ($rooms === []) {
            return $this->sidRooms !== [];
        }

        foreach ($rooms as $room) {
            if (! empty($this->roomSids[$this->getLocalRoomKey($room)])) {
                return true;
            }
        }
        return false;
    }

    private function pushNodeQueue(string $nodeId, string $packet, array $opts, array $rooms): void
    {
        $lane = $this->chooseQueueLane($rooms, $packet);
        $queueKey = $this->getNodeQueueKey($nodeId, $lane);
        $payload = $this->packQueuePayload($packet, $opts);
        if ($payload === null) {
            return;
        }

        $queueMaxLength = $this->queueMaxLength;
        $queueTtlSeconds = $this->queueTtlSeconds;
        $this->pipeline($this->queueRedis, static function ($pipeline) use ($queueKey, $payload, $queueMaxLength, $queueTtlSeconds) {
            $pipeline->lPush($queueKey, $payload);
            $pipeline->lTrim($queueKey, 0, $queueMaxLength - 1);
            $pipeline->expire($queueKey, $queueTtlSeconds);
        });
    }

    private function consumeQueueLane(int $lane): void
    {
        $queueKey = $this->getNodeQueueKey($this->getNodeId(), $lane);
        while (true) {
            if (CoordinatorManager::until(Constants::WORKER_EXIT)->yield(0.001)) {
                break;
            }

            $result = $this->queueRedis->brPop($queueKey, $this->queuePopTimeoutSeconds);
            if (! is_array($result) || ! isset($result[1])) {
                continue;
            }
            $this->handleQueuePayload((string) $result[1]);
        }
    }

    private function handleQueuePayload(string $payload): void
    {
        try {
            $data = Json::decode($payload);
            if (! is_array($data) || ($data['v'] ?? null) !== self::ENVELOPE_VERSION) {
                return;
            }
            $packet = base64_decode((string) ($data['packet'] ?? ''), true);
            if ($packet === false) {
                return;
            }
            $opts = $data['opts'] ?? [];
            $this->doBroadcast($packet, is_array($opts) ? $opts : []);
        } catch (Throwable $throwable) {
            $this->logger->warning(sprintf(
                'socketioNodeQueue event=decodeFailed namespace=%s error=%s',
                $this->nsp->getNamespace(),
                $this->formatThrowable($throwable)
            ));
        }
    }

    private function packQueuePayload(string $packet, array $opts): ?string
    {
        try {
            return Json::encode([
                'v' => self::ENVELOPE_VERSION,
                'namespace' => $this->nsp->getNamespace(),
                'origin' => $this->getNodeId(),
                'origin_server' => $this->getServerId(),
                'packet' => base64_encode($packet),
                'opts' => $opts,
                'created_at_ms' => $this->nowMs(),
            ]);
        } catch (Throwable $throwable) {
            $this->logger->error(sprintf(
                'socketioNodeQueue event=encodeFailed namespace=%s error=%s',
                $this->nsp->getNamespace(),
                $this->formatThrowable($throwable)
            ));
            return null;
        }
    }

    private function tryPush(
        string $sid,
        string $packet,
        ?string &$resolvedPacket,
        array &$pushed,
        array $opts,
        array $exceptSet
    ): void {
        if (isset($exceptSet[$sid])) {
            return;
        }

        if (! $this->isLocal($sid)) {
            return;
        }

        $fd = $this->getFd($sid);
        if ($fd <= 0 || isset($pushed[$fd])) {
            return;
        }

        $actualPacket = $this->resolvePacketForLocalPush($packet, $resolvedPacket);
        $this->sender->pushFrame($fd, new Frame(payloadData: $actualPacket));
        $pushed[$fd] = true;
        $this->shouldClose($opts) && $this->closeFd($fd, $sid);
    }

    /**
     * @param-out string $resolvedPacket
     */
    private function resolvePacketForLocalPush(string $packet, ?string &$resolvedPacket): string
    {
        if ($resolvedPacket !== null) {
            return $resolvedPacket;
        }

        $resolvedPacket = $this->messageContentProvider === null
            ? $packet
            : $this->messageContentProvider->resolveActualPacket($packet);
        return $resolvedPacket;
    }

    private function registerRoomNode(string $roomHash): void
    {
        $nodeId = $this->getNodeId();
        $roomNodesKey = $this->getRoomNodesKeyByHash($roomHash);
        $nodeRoomsKey = $this->getNodeRoomsKey($nodeId);
        $ttl = $this->indexTtlSeconds;
        $this->pipeline($this->redis, static function ($pipeline) use ($roomNodesKey, $nodeRoomsKey, $nodeId, $roomHash, $ttl) {
            $pipeline->sAdd($roomNodesKey, $nodeId);
            $pipeline->expire($roomNodesKey, $ttl);
            $pipeline->sAdd($nodeRoomsKey, $roomHash);
            $pipeline->expire($nodeRoomsKey, $ttl);
        });
    }

    private function ensureRoomNode(string $roomHash): void
    {
        $key = $this->getRoomNodesKeyByHash($roomHash);
        $nodeId = $this->getNodeId();
        $ttl = $this->indexTtlSeconds;
        $this->pipeline($this->redis, static function ($pipeline) use ($key, $nodeId, $ttl) {
            $pipeline->sAdd($key, $nodeId);
            $pipeline->expire($key, $ttl);
        });
    }

    private function unregisterRoomNode(string $roomHash): void
    {
        $nodeId = $this->getNodeId();
        $roomNodesKey = $this->getRoomNodesKeyByHash($roomHash);
        $nodeRoomsKey = $this->getNodeRoomsKey($nodeId);
        $nodeRoomSidsKey = $this->getNodeRoomSidsKey($nodeId, $roomHash);
        $this->pipeline($this->redis, static function ($pipeline) use ($roomNodesKey, $nodeRoomsKey, $nodeRoomSidsKey, $nodeId, $roomHash) {
            $pipeline->sRem($roomNodesKey, $nodeId);
            $pipeline->sRem($nodeRoomsKey, $roomHash);
            $pipeline->del($nodeRoomSidsKey);
        });
    }

    private function registerSidRoom(string $sid, string $room, string $roomHash): void
    {
        $nodeId = $this->getNodeId();
        $sidRoomsKey = $this->getSidRoomsKey($sid);
        $nodeRoomSidsKey = $this->getNodeRoomSidsKey($nodeId, $roomHash);
        $ttl = $this->indexTtlSeconds;
        $this->pipeline($this->redis, static function ($pipeline) use ($sidRoomsKey, $nodeRoomSidsKey, $sid, $room, $ttl) {
            $pipeline->sAdd($sidRoomsKey, $room);
            $pipeline->expire($sidRoomsKey, $ttl);
            $pipeline->sAdd($nodeRoomSidsKey, $sid);
            $pipeline->expire($nodeRoomSidsKey, $ttl);
        });
    }

    private function registerNodeSid(string $sid): void
    {
        $nodeId = $this->getNodeId();
        $nodeSidsKey = $this->getNodeSidsKey($nodeId);
        $sidNodeKey = $this->getSidNodeKey($sid);
        $ttl = $this->indexTtlSeconds;
        $this->pipeline($this->redis, static function ($pipeline) use ($nodeSidsKey, $sidNodeKey, $nodeId, $sid, $ttl) {
            $pipeline->sAdd($nodeSidsKey, $sid);
            $pipeline->expire($nodeSidsKey, $ttl);
            $pipeline->set($sidNodeKey, $nodeId);
            $pipeline->expire($sidNodeKey, $ttl);
        });
    }

    private function unregisterSidRoom(string $sid, string $room, string $roomHash): void
    {
        $nodeId = $this->getNodeId();
        $sidRoomsKey = $this->getSidRoomsKey($sid);
        $nodeRoomSidsKey = $this->getNodeRoomSidsKey($nodeId, $roomHash);
        $this->pipeline($this->redis, static function ($pipeline) use ($sidRoomsKey, $nodeRoomSidsKey, $sid, $room) {
            $pipeline->sRem($sidRoomsKey, $room);
            $pipeline->sRem($nodeRoomSidsKey, $sid);
        });
    }

    private function deleteLocalSidIndex(string $sid): void
    {
        $nodeSidsKey = $this->getNodeSidsKey($this->getNodeId());
        $sidRoomsKey = $this->getSidRoomsKey($sid);
        $sidNodeKey = $this->getSidNodeKey($sid);
        $this->pipeline($this->redis, static function ($pipeline) use ($nodeSidsKey, $sidRoomsKey, $sidNodeKey, $sid) {
            $pipeline->sRem($nodeSidsKey, $sid);
            $pipeline->del($sidRoomsKey);
            $pipeline->del($sidNodeKey);
        });
    }

    private function syncSidNode(string $sid): void
    {
        $key = $this->getSidNodeKey($sid);
        $nodeId = $this->getNodeId();
        $ttl = $this->indexTtlSeconds;
        $this->pipeline($this->redis, static function ($pipeline) use ($key, $nodeId, $ttl) {
            $pipeline->set($key, $nodeId);
            $pipeline->expire($key, $ttl);
        });
    }

    /**
     * @param string[] $members
     */
    private function replaceSet(string $key, array $members): void
    {
        $members = array_values(array_unique(array_filter($members, static fn (string $member) => $member !== '')));
        $ttl = $this->indexTtlSeconds;
        $this->pipeline($this->redis, static function ($pipeline) use ($key, $members, $ttl) {
            $pipeline->del($key);
            if ($members === []) {
                return;
            }
            $pipeline->sAdd($key, ...$members);
            $pipeline->expire($key, $ttl);
        });
    }

    private function pipeline(\Hyperf\Redis\Redis|Redis|RedisProxy $redis, callable $commands): mixed
    {
        $pipeline = $redis->pipeline();
        $commands($pipeline);
        return $pipeline->exec();
    }

    private function runMaintenanceTask(string $event, callable $task): void
    {
        try {
            $task();
        } catch (Throwable $throwable) {
            $this->logger->warning(sprintf(
                'socketioMaintenance event=%s namespace=%s error=%s',
                $event,
                $this->nsp->getNamespace(),
                $this->formatThrowable($throwable)
            ));
        }
    }

    private function refreshNodeHeartbeat(): void
    {
        $nodeId = $this->getNodeId();
        $key = $this->getNodesKey($this->getNodeBucket($nodeId));
        $nowMs = $this->nowMs();
        $ttl = $this->indexTtlSeconds;
        $this->pipeline($this->redis, static function ($pipeline) use ($key, $nowMs, $nodeId, $ttl) {
            $pipeline->zAdd($key, $nowMs, $nodeId);
            $pipeline->expire($key, $ttl);
        });
    }

    private function isNodeAlive(string $nodeId): bool
    {
        $score = $this->redis->zScore($this->getNodesKey($this->getNodeBucket($nodeId)), $nodeId);
        return is_numeric($score) && (float) $score >= $this->nowMs() - $this->nodeExpireMs;
    }

    private function getActiveNodeIds(): array
    {
        $nowMs = $this->nowMs();
        if ($this->activeNodeCacheTtlMs > 0 && $this->activeNodeIdsCacheExpiresAtMs > $nowMs) {
            return $this->activeNodeIdsCache;
        }

        $active = [];
        $minScore = (string) ($nowMs - $this->nodeExpireMs);
        for ($bucket = 0; $bucket < $this->nodeBucketCount; ++$bucket) {
            foreach ((array) $this->redis->zRangeByScore($this->getNodesKey($bucket), $minScore, '+inf') as $nodeId) {
                $active[(string) $nodeId] = true;
            }
        }
        $this->activeNodeIdsCache = array_keys($active);
        $this->activeNodeIdsCacheExpiresAtMs = $nowMs + $this->activeNodeCacheTtlMs;
        return $this->activeNodeIdsCache;
    }

    private function getRoomNodeIds(string $room): array
    {
        return array_values(array_map('strval', (array) $this->redis->sMembers($this->getRoomNodesKey($room))));
    }

    private function acquireCleanupLock(int $bucket): bool
    {
        return (bool) $this->redis->set($this->getCleanupLockKey($bucket), $this->getNodeId(), [
            'nx',
            'ex' => max(5, (int) ceil($this->nodeCleanupIntervalMs / 1000)),
        ]);
    }

    private function appendUniqueSid(array &$result, array &$pushed, string $sid): void
    {
        if ($sid === '' || isset($pushed[$sid])) {
            return;
        }

        $result[] = $sid;
        $pushed[$sid] = true;
    }

    /**
     * @param string[] $rooms
     * @return string[]
     */
    private function normalizeRooms(array $rooms): array
    {
        $normalized = [];
        foreach ($rooms as $room) {
            $room = (string) $room;
            if ($room !== '') {
                $normalized[$this->getLocalRoomKey($room)] = $room;
            }
        }
        return array_values($normalized);
    }

    private function getLocalRoomKey(string $room): string
    {
        return 'room:' . $room;
    }

    private function getRoomFromLocalKey(string $roomKey): string
    {
        return str_starts_with($roomKey, 'room:') ? substr($roomKey, 5) : $roomKey;
    }

    private function extractRooms(array $opts): array
    {
        $rooms = data_get($opts, 'rooms', []);
        if (is_array($rooms) && ! empty($rooms)) {
            $normalizedRooms = $this->normalizeRooms($rooms);
            if ($normalizedRooms !== []) {
                return $normalizedRooms;
            }
        }

        $room = data_get($opts, 'room');
        if ($room === null) {
            return [];
        }

        return $this->normalizeRooms([$room]);
    }

    /**
     * @param array<int|string, mixed> $except
     * @return array<string, true>
     */
    private function buildExceptSet(array $except): array
    {
        $set = [];
        foreach ($except as $sid) {
            $sid = (string) $sid;
            if ($sid !== '') {
                $set[$sid] = true;
            }
        }

        return $set;
    }

    private function chooseQueueLane(array $rooms, string $packet): int
    {
        $seed = $rooms === [] ? $packet : implode('|', array_map(fn (string $room) => $this->hashValue($room), $rooms));
        return $this->stableModulo($seed, $this->queueLaneCount);
    }

    private function getNamespaceHash(): string
    {
        return $this->hashValue($this->nsp->getNamespace());
    }

    private function getRoomNodesKey(string $room): string
    {
        return $this->getRoomNodesKeyByHash($this->hashValue($room));
    }

    private function getRoomNodesKeyByHash(string $roomHash): string
    {
        return $this->makeClusterKey(
            'room_nodes:' . $this->getNamespaceHash() . ':' . $roomHash,
            'room_nodes',
            $this->getNamespaceHash(),
            $roomHash
        );
    }

    private function getNodeRoomsKey(string $nodeId): string
    {
        return $this->makeClusterKey(
            'node:' . $this->getNamespaceHash() . ':' . $nodeId,
            'node_rooms',
            $this->getNamespaceHash(),
            $nodeId
        );
    }

    private function getNodeSidsKey(string $nodeId): string
    {
        return $this->makeClusterKey(
            'node:' . $this->getNamespaceHash() . ':' . $nodeId,
            'node_sids',
            $this->getNamespaceHash(),
            $nodeId
        );
    }

    private function getNodeRoomSidsKey(string $nodeId, string $roomHash): string
    {
        return $this->makeClusterKey(
            'node_room_sids:' . $this->getNamespaceHash() . ':' . $nodeId . ':' . $roomHash,
            'node_room_sids',
            $this->getNamespaceHash(),
            $nodeId,
            $roomHash
        );
    }

    private function getSidRoomsKey(string $sid): string
    {
        $sidHash = $this->hashValue($sid);
        return $this->makeClusterKey(
            'sid:' . $this->getNamespaceHash() . ':' . $sidHash,
            'sid_rooms',
            $this->getNamespaceHash(),
            $sidHash
        );
    }

    private function getSidNodeKey(string $sid): string
    {
        $sidHash = $this->hashValue($sid);
        return $this->makeClusterKey(
            'sid:' . $this->getNamespaceHash() . ':' . $sidHash,
            'sid_node',
            $this->getNamespaceHash(),
            $sidHash
        );
    }

    private function getNodesKey(int $bucket): string
    {
        return $this->makeClusterKey(
            'nodes:' . $bucket,
            'nodes',
            (string) $bucket
        );
    }

    private function getNodeQueueKey(string $nodeId, int $lane): string
    {
        return $this->makeClusterKey(
            'node_queue:' . $this->getNamespaceHash() . ':' . $nodeId . ':' . $lane,
            'node_queue',
            $this->getNamespaceHash(),
            $nodeId,
            (string) $lane
        );
    }

    private function getCleanupLockKey(int $bucket): string
    {
        return $this->makeClusterKey(
            'nodes:' . $bucket,
            'cleanup_lock',
            (string) $bucket
        );
    }

    private function makeClusterKey(string $routeSeed, string ...$parts): string
    {
        return implode(':', array_merge([
            $this->redisPrefix,
            $this->getClusterRouteTag($routeSeed),
        ], $parts));
    }

    private function getClusterRouteTag(string $routeSeed): string
    {
        // Redis Cluster 只按花括号里的内容算 slot。
        // routeSeed 必须来自 room/node/sid/bucket/lane 这类高基数字段，不能只用 namespace。
        return '{socketio:' . $this->hashValue($routeSeed) . '}';
    }

    private function getNodeBucket(string $nodeId): int
    {
        return $this->stableModulo($nodeId, $this->nodeBucketCount);
    }

    private function getServerId(): string
    {
        if (SocketIO::$serverId !== '') {
            return SocketIO::$serverId;
        }
        $pid = getmypid();
        if ($pid === false) {
            $pid = 0;
        }
        return 'local-' . $pid;
    }

    private function getNodeId(): string
    {
        $pid = getmypid();
        if ($pid === false) {
            $pid = 0;
        }
        return $this->getServerId() . ':p' . $pid;
    }

    private function hashValue(string $value): string
    {
        return sha1($value);
    }

    private function stableModulo(string $value, int $modulo): int
    {
        return sprintf('%u', crc32($value)) % $modulo;
    }

    private function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }

    private function shouldClose(array $opts)
    {
        return data_get($opts, 'flag.close', false);
    }

    private function closeFd(int $fd, string $sid): bool
    {
        try {
            $this->sender->disconnect($fd);
            return true;
        } catch (Throwable $throwable) {
            $this->logger->warning(sprintf(
                'sidGuard event=closeFdFailed sid=%s fd=%d namespace=%s error=%s',
                $sid,
                $fd,
                $this->nsp->getNamespace(),
                $this->formatThrowable($throwable)
            ));
            return false;
        }
    }

    private function formatThrowable(Throwable $throwable): string
    {
        return (string) $throwable;
    }
}
