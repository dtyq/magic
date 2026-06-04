<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\SocketIOServer\Room;

use App\Domain\Chat\Service\MessageContentProviderInterface;
use App\Infrastructure\Core\ClassMap\SocketIoServer\DistributedSidCodec;
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
 * Socket.IO Redis Adapter v3.
 *
 * v3 keeps fan-out decisions in local worker memory and uses Redis only for
 * cross-node routing and low-frequency compatibility queries. This avoids the
 * v1 Pub/Sub / room-set hot keys and the v2 per-sid key explosion.
 *
 * Sid self-room routing depends on DistributedSidCodec. Changing sid format
 * without updating codec + v3 routing tests can make remote sid-room delivery
 * silently fail.
 */
class RedisAdapter implements AdapterInterface, EphemeralInterface
{
    use HasLogger;

    private const int ENVELOPE_VERSION = 1;

    private const int MAX_NODE_HEARTBEAT_INTERVAL_MS = 60000;

    private const int MAX_NODE_EXPIRE_MS = 300000;

    private const int MAX_INDEX_RENEW_INTERVAL_MS = 60000;

    private const int MAX_INDEX_TTL_SECONDS = 300;

    private const int MAX_QUEUE_TTL_SECONDS = 60;

    private const int MAX_CLEANUP_LOCK_TTL_SECONDS = 60;

    protected string $redisPrefix = 'magicChat:SocketIo:RedisAdapter:v3';

    protected int $retryInterval = 1000;

    protected int $nodeHeartbeatIntervalMs = 5000;

    protected int $nodeExpireMs = 30000;

    protected int $nodeCleanupIntervalMs = 30000;

    protected int $indexRenewIntervalMs = 60000;

    protected int $localCleanupIntervalMs = 60000;

    protected int $localCleanupBatchSize = 5000;

    protected int $activeNodeCacheTtlMs = 1000;

    protected int $nodeCleanupBatchSize = 200;

    protected int $nodeBucketCount = 128;

    protected int $queueLaneCount = 4;

    protected int $queueMaxLength = 2000;

    protected int $queueTtlSeconds = 60;

    protected int $queuePopTimeoutSeconds = 1;

    protected int $indexTtlSeconds = 300;

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

    private bool $indexDirty = false;

    /**
     * @var string[]
     */
    private array $activeNodeIdsCache = [];

    private int $activeNodeIdsCacheExpiresAtMs = 0;

    private int $nextHeartbeatRefreshAtMs = 0;

    private int $localCleanupCursor = 0;

    /**
     * @var array<int, int>
     */
    private array $nextQueueLeaseRefreshAtMs = [];

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
        if ($sid === '' || $rooms === []) {
            return;
        }

        $rooms = $this->normalizeRooms($rooms);
        if ($rooms === []) {
            return;
        }

        $this->refreshNodeHeartbeatIfDue();
        $touchedBusinessRooms = [];
        $newSid = ! isset($this->sidRooms[$sid]);

        foreach ($rooms as $room) {
            $roomKey = $this->getLocalRoomKey($room);
            if (isset($this->sidRooms[$sid][$roomKey])) {
                continue;
            }

            $businessRoom = ! DistributedSidCodec::isSelfRoom($sid, $room);
            $roomWasEmpty = empty($this->roomSids[$roomKey]);
            $this->sidRooms[$sid][$roomKey] = $room;
            $this->roomSids[$roomKey][$sid] = true;
            $this->roomLocalCount[$roomKey] = ($this->roomLocalCount[$roomKey] ?? 0) + 1;

            if ($businessRoom) {
                $touchedBusinessRooms[$room] = $roomWasEmpty;
            }
        }

        if (! isset($this->sidRooms[$sid])) {
            return;
        }

        $this->runRedisWrite('add', function () use ($sid, $touchedBusinessRooms, $newSid) {
            $nodeId = $this->getNodeId();
            $ttl = $this->indexTtlSeconds;
            $this->pipeline($this->redis, function ($pipeline) use ($sid, $touchedBusinessRooms, $newSid, $nodeId, $ttl) {
                if ($newSid) {
                    $pipeline->expire($this->getNodeSidRoomsKey($nodeId), $ttl);
                }
                $this->pipelineSyncSidRoomsField($pipeline, $nodeId, $sid);
                foreach ($touchedBusinessRooms as $room => $roomWasEmpty) {
                    $roomHash = $this->hashValue((string) $room);
                    if ($roomWasEmpty) {
                        $pipeline->sAdd($this->getRoomNodesKeyByHash($roomHash), $nodeId);
                        $pipeline->expire($this->getRoomNodesKeyByHash($roomHash), $ttl);
                    }
                    $this->pipelineSyncRoomSidsField($pipeline, $nodeId, $roomHash, (string) $room);
                }
            });
        });
    }

    public function del(string $sid, string ...$rooms): void
    {
        if ($sid === '' || ! isset($this->sidRooms[$sid])) {
            return;
        }

        $targetRooms = $rooms === [] ? array_values($this->sidRooms[$sid]) : $this->normalizeRooms($rooms);
        if ($targetRooms === []) {
            return;
        }

        $touchedBusinessRooms = [];
        foreach ($targetRooms as $room) {
            $roomKey = $this->getLocalRoomKey($room);
            if (! isset($this->sidRooms[$sid][$roomKey])) {
                continue;
            }

            unset($this->sidRooms[$sid][$roomKey], $this->roomSids[$roomKey][$sid]);
            $this->roomLocalCount[$roomKey] = max(0, ($this->roomLocalCount[$roomKey] ?? 1) - 1);
            if (! DistributedSidCodec::isSelfRoom($sid, $room)) {
                $touchedBusinessRooms[$room] = $this->roomLocalCount[$roomKey] === 0;
            }
            if ($this->roomLocalCount[$roomKey] === 0) {
                unset($this->roomLocalCount[$roomKey], $this->roomSids[$roomKey]);
            }
        }

        $sidStillKnown = ! empty($this->sidRooms[$sid]);
        if (! $sidStillKnown) {
            unset($this->sidRooms[$sid]);
        }

        $nodeHasLocalSids = $this->sidRooms !== [];
        $this->runRedisWrite('del', function () use ($sid, $touchedBusinessRooms, $sidStillKnown, $nodeHasLocalSids) {
            $nodeId = $this->getNodeId();
            $ttl = $this->indexTtlSeconds;
            $this->pipeline($this->redis, function ($pipeline) use ($sid, $touchedBusinessRooms, $sidStillKnown, $nodeHasLocalSids, $nodeId, $ttl) {
                if ($sidStillKnown) {
                    $this->pipelineSyncSidRoomsField($pipeline, $nodeId, $sid);
                } else {
                    $pipeline->hDel($this->getNodeSidRoomsKey($nodeId), $sid);
                    if ($nodeHasLocalSids) {
                        $pipeline->expire($this->getNodeSidRoomsKey($nodeId), $ttl);
                    }
                }

                foreach ($touchedBusinessRooms as $room => $roomIsEmpty) {
                    $roomHash = $this->hashValue((string) $room);
                    if ($roomIsEmpty) {
                        $pipeline->sRem($this->getRoomNodesKeyByHash($roomHash), $nodeId);
                        $pipeline->expire($this->getRoomNodesKeyByHash($roomHash), $ttl);
                        $pipeline->hDel($this->getNodeRoomSidsKey($nodeId), $roomHash);
                        if ($nodeHasLocalSids) {
                            $pipeline->expire($this->getNodeRoomSidsKey($nodeId), $ttl);
                        }
                        continue;
                    }
                    $this->pipelineSyncRoomSidsField($pipeline, $nodeId, $roomHash, (string) $room);
                }

                if (! $nodeHasLocalSids) {
                    $pipeline->del($this->getNodeSidRoomsKey($nodeId));
                    $pipeline->del($this->getNodeRoomSidsKey($nodeId));
                }
            });
        });
    }

    public function broadcast($packet, $opts): void
    {
        $packet = (string) $packet;
        $opts = is_array($opts) ? $opts : [];
        if (data_get($opts, 'flag.local', false)) {
            $this->doBroadcast($packet, $opts);
            return;
        }

        $rooms = $this->extractRooms($opts);
        $targetNodes = $this->resolveTargetNodes($rooms);
        if ($targetNodes === []) {
            return;
        }

        $currentNodeId = $this->getNodeId();
        foreach (array_keys($targetNodes) as $nodeId) {
            if ($nodeId === $currentNodeId) {
                $this->doBroadcast($packet, $opts);
                continue;
            }
            $this->pushNodeQueue($nodeId, $packet, $opts, $rooms);
        }
    }

    public function clients(string ...$rooms): array
    {
        $rooms = $this->normalizeRooms($rooms);
        $result = [];
        $pushed = [];

        if ($rooms !== []) {
            foreach ($rooms as $room) {
                foreach (array_keys($this->roomSids[$this->getLocalRoomKey($room)] ?? []) as $sid) {
                    $this->appendUniqueSid($result, $pushed, $sid);
                }

                $sidNodeId = DistributedSidCodec::parseNodeIdFromSid($room);
                if ($sidNodeId !== null) {
                    foreach ($this->getRemoteSidRoomClient($sidNodeId, $room) as $sid) {
                        $this->appendUniqueSid($result, $pushed, $sid);
                    }
                    continue;
                }

                $roomHash = $this->hashValue($room);
                foreach ($this->getRoomNodeIds($roomHash) as $nodeId) {
                    if ($nodeId === $this->getNodeId()) {
                        continue;
                    }
                    $sids = $this->decodeStringList((string) ($this->redis->hGet($this->getNodeRoomSidsKey($nodeId), $roomHash) ?: '[]'));
                    foreach ($sids as $sid) {
                        $this->appendUniqueSid($result, $pushed, $sid);
                    }
                }
            }
            return $result;
        }

        foreach (array_keys($this->sidRooms) as $sid) {
            $this->appendUniqueSid($result, $pushed, $sid);
        }
        foreach ($this->getActiveNodeIds() as $nodeId) {
            if ($nodeId === $this->getNodeId()) {
                continue;
            }
            foreach ((array) $this->redis->hKeys($this->getNodeSidRoomsKey($nodeId)) as $sid) {
                $this->appendUniqueSid($result, $pushed, (string) $sid);
            }
        }
        return $result;
    }

    public function clientRooms(string $sid): array
    {
        if ($sid === '') {
            return [];
        }

        if (isset($this->sidRooms[$sid])) {
            return array_values($this->sidRooms[$sid]);
        }

        $nodeId = DistributedSidCodec::parseNodeIdFromSid($sid);
        if ($nodeId === null) {
            $this->logger->warning(sprintf('socketioSidCodec event=parseFailed sid=%s namespace=%s', $sid, $this->nsp->getNamespace()));
            return [];
        }
        if (! $this->isNodeAlive($nodeId)) {
            return [];
        }

        $value = $this->redis->hGet($this->getNodeSidRoomsKey($nodeId), $sid);
        if (! is_string($value)) {
            return [];
        }

        $rooms = $this->decodeStringList($value);
        $rooms[] = $sid;
        return $this->normalizeRooms($rooms);
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
            $this->runMaintenanceTask('renewIndexLease', fn () => $this->renewLocalIndexLeases());
            while (true) {
                if (CoordinatorManager::until(Constants::WORKER_EXIT)->yield($this->indexRenewIntervalMs / 1000)) {
                    break;
                }
                $this->runMaintenanceTask('renewIndexLease', fn () => $this->renewLocalIndexLeases());
            }
        });

        Coroutine::create(function () {
            while (true) {
                if (CoordinatorManager::until(Constants::WORKER_EXIT)->yield($this->nodeCleanupIntervalMs / 1000)) {
                    break;
                }
                $this->runMaintenanceTask('cleanupDeadNode', fn () => $this->cleanUpExpiredOnce());
            }
        });

        Coroutine::create(function () {
            while (true) {
                if (CoordinatorManager::until(Constants::WORKER_EXIT)->yield($this->localCleanupIntervalMs / 1000)) {
                    break;
                }
                $this->runMaintenanceTask('cleanupLocalOrphanSid', fn () => $this->cleanUpLocalOrphanSidsOnce());
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

            $nodeIds = (array) $this->redis->zRangeByScore($this->getNodesKey($bucket), '-inf', $cutoff, [
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

    public function cleanUpLocalOrphanSidsOnce(): int
    {
        $sids = array_keys($this->sidRooms);
        $count = count($sids);
        if ($count === 0) {
            $this->localCleanupCursor = 0;
            return 0;
        }

        $cleaned = 0;
        $limit = min($count, $this->localCleanupBatchSize);
        for ($i = 0; $i < $limit; ++$i) {
            $index = ($this->localCleanupCursor + $i) % $count;
            $sid = (string) $sids[$index];
            try {
                if ($this->sidProvider->isLocal($sid)) {
                    continue;
                }
                $this->del($sid);
                ++$cleaned;
            } catch (Throwable $throwable) {
                $this->logger->warning(sprintf(
                    'socketioLocalCleanup event=sidCheckFailed sid=%s namespace=%s error=%s',
                    $sid,
                    $this->nsp->getNamespace(),
                    $this->formatThrowable($throwable)
                ));
            }
        }

        $this->localCleanupCursor = ($this->localCleanupCursor + $limit) % $count;
        return $cleaned;
    }

    public function renewLocalIndexLeases(): void
    {
        $this->refreshNodeHeartbeat();
        $nodeId = $this->getNodeId();
        $ttl = $this->indexTtlSeconds;
        $businessRooms = $this->getBusinessRooms();
        $sids = array_keys($this->sidRooms);

        if ($businessRooms === [] && $sids === [] && ! $this->indexDirty) {
            return;
        }

        $this->runRedisWrite('renewIndexLease', function () use ($nodeId, $ttl, $businessRooms, $sids) {
            if ($this->indexDirty) {
                $this->rebuildLocalRouteIndex($nodeId, $ttl, $businessRooms, $sids);
                $this->indexDirty = false;
                return;
            }

            $this->pipeline($this->redis, function ($pipeline) use ($nodeId, $ttl, $businessRooms, $sids) {
                $pipeline->expire($this->getNodeRoomSidsKey($nodeId), $ttl);
                $pipeline->expire($this->getNodeSidRoomsKey($nodeId), $ttl);

                foreach ($businessRooms as $room) {
                    $roomHash = $this->hashValue($room);
                    $pipeline->sAdd($this->getRoomNodesKeyByHash($roomHash), $nodeId);
                    $pipeline->expire($this->getRoomNodesKeyByHash($roomHash), $ttl);
                    $this->pipelineSyncRoomSidsField($pipeline, $nodeId, $roomHash, $room);
                }

                foreach ($sids as $sid) {
                    $this->pipelineSyncSidRoomsField($pipeline, $nodeId, (string) $sid);
                }
            });
            $this->indexDirty = false;
        });
    }

    public function setTtl(int $ms): EphemeralInterface
    {
        $this->ttl = $ms;
        return $this;
    }

    public function renew(string $sid): void
    {
        // v3 uses local connection state + node heartbeat. Per-ping Redis writes
        // would recreate the old expire zset hot key.
    }

    public function disconnectSid(string $sid): void
    {
        if ($sid === '') {
            return;
        }

        if ($this->isLocal($sid)) {
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

        $roomHashes = (array) $this->redis->hKeys($this->getNodeRoomSidsKey($nodeId));
        $ttl = $this->indexTtlSeconds;
        $this->pipeline($this->redis, function ($pipeline) use ($nodeId, $roomHashes, $ttl) {
            foreach ($roomHashes as $roomHash) {
                $pipeline->sRem($this->getRoomNodesKeyByHash((string) $roomHash), $nodeId);
                $pipeline->expire($this->getRoomNodesKeyByHash((string) $roomHash), $ttl);
            }
            $pipeline->del($this->getNodeRoomSidsKey($nodeId));
            $pipeline->del($this->getNodeSidRoomsKey($nodeId));
            $pipeline->zRem($this->getNodesKey($this->getNodeBucket($nodeId)), $nodeId);
            $pipeline->expire($this->getNodesKey($this->getNodeBucket($nodeId)), $ttl);
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
            $this->tryPush((string) $sid, $packet, $resolvedPacket, $pushed, $opts, $exceptSet);
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

    private function loadRuntimeConfig(): void
    {
        $this->queueConnection = (string) env('SOCKETIO_REDIS_QUEUE_CONNECTION', $this->queueConnection);
        $this->nodeHeartbeatIntervalMs = min(
            self::MAX_NODE_HEARTBEAT_INTERVAL_MS,
            max(1000, (int) env('SOCKETIO_NODE_HEARTBEAT_MS', $this->nodeHeartbeatIntervalMs))
        );
        $this->nodeExpireMs = min(
            self::MAX_NODE_EXPIRE_MS,
            max($this->nodeHeartbeatIntervalMs * 2, (int) env('SOCKETIO_NODE_EXPIRE_MS', $this->nodeExpireMs))
        );
        $this->nodeCleanupIntervalMs = max(1000, (int) env('SOCKETIO_NODE_CLEANUP_MS', $this->nodeCleanupIntervalMs));
        $legacyReconcileIntervalMs = (int) env('SOCKETIO_NODE_RECONCILE_MS', 0);
        $defaultIndexRenewIntervalMs = $legacyReconcileIntervalMs > 0 ? $legacyReconcileIntervalMs : $this->indexRenewIntervalMs;
        $this->indexRenewIntervalMs = min(
            self::MAX_INDEX_RENEW_INTERVAL_MS,
            max($this->nodeHeartbeatIntervalMs, (int) env('SOCKETIO_INDEX_RENEW_MS', $defaultIndexRenewIntervalMs))
        );
        $this->localCleanupIntervalMs = max(1000, (int) env('SOCKETIO_LOCAL_CLEANUP_MS', $this->localCleanupIntervalMs));
        $this->localCleanupBatchSize = max(100, (int) env('SOCKETIO_LOCAL_CLEANUP_BATCH_SIZE', $this->localCleanupBatchSize));
        $this->activeNodeCacheTtlMs = max(0, (int) env('SOCKETIO_ACTIVE_NODE_CACHE_TTL_MS', $this->activeNodeCacheTtlMs));
        $this->nodeBucketCount = max(1, (int) env('SOCKETIO_NODE_BUCKET_COUNT', $this->nodeBucketCount));
        $this->queueLaneCount = max(1, (int) env('SOCKETIO_QUEUE_LANE_COUNT', $this->queueLaneCount));
        $this->queueMaxLength = max(100, (int) env('SOCKETIO_QUEUE_MAX_LENGTH', $this->queueMaxLength));
        $this->queueTtlSeconds = min(
            self::MAX_QUEUE_TTL_SECONDS,
            max(10, (int) env('SOCKETIO_QUEUE_TTL_SECONDS', $this->queueTtlSeconds))
        );
        $this->queuePopTimeoutSeconds = max(1, (int) env('SOCKETIO_QUEUE_POP_TIMEOUT_SECONDS', $this->queuePopTimeoutSeconds));
        $minimumIndexTtlSeconds = max(60, (int) ceil($this->indexRenewIntervalMs / 1000) * 3);
        $this->indexTtlSeconds = min(
            self::MAX_INDEX_TTL_SECONDS,
            max($minimumIndexTtlSeconds, (int) env('SOCKETIO_INDEX_TTL_SECONDS', $this->indexTtlSeconds))
        );
    }

    private function resolveTargetNodes(array $rooms): array
    {
        $targetNodes = [];
        if ($rooms === []) {
            foreach ($this->getActiveNodeIds() as $nodeId) {
                $targetNodes[$nodeId] = true;
            }
            if ($this->sidRooms !== []) {
                $targetNodes[$this->getNodeId()] = true;
            }
            return $targetNodes;
        }

        foreach ($rooms as $room) {
            $sidNodeId = DistributedSidCodec::parseNodeIdFromSid($room);
            if ($sidNodeId !== null) {
                if ($sidNodeId === $this->getNodeId() || $this->isNodeAlive($sidNodeId)) {
                    $targetNodes[$sidNodeId] = true;
                }
                continue;
            }

            foreach ($this->getRoomNodeIds($this->hashValue($room)) as $nodeId) {
                $targetNodes[$nodeId] = true;
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

    private function getRemoteSidRoomClient(string $nodeId, string $sid): array
    {
        if ($nodeId === $this->getNodeId() || ! $this->isNodeAlive($nodeId)) {
            return [];
        }

        return is_string($this->redis->hGet($this->getNodeSidRoomsKey($nodeId), $sid)) ? [$sid] : [];
    }

    private function pushNodeQueue(string $nodeId, string $packet, array $opts, array $rooms): void
    {
        $payload = $this->packQueuePayload($packet, $opts);
        if ($payload === null) {
            return;
        }

        $lane = $this->chooseQueueLane($rooms, $packet);
        $queueKey = $this->getNodeQueueKey($nodeId, $lane);
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
            if (! is_array($result)) {
                continue;
            }
            $payload = $result[1] ?? end($result);
            if (! is_string($payload)) {
                continue;
            }
            $this->handleQueuePayload($payload);
            $this->refreshQueueLeaseIfDue($queueKey, $lane);
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
        if (isset($exceptSet[$sid]) || ! $this->isLocal($sid)) {
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

    private function pipelineSyncSidRoomsField(object $pipeline, string $nodeId, string $sid): void
    {
        $businessRooms = [];
        foreach ($this->sidRooms[$sid] ?? [] as $room) {
            if (! DistributedSidCodec::isSelfRoom($sid, $room)) {
                $businessRooms[] = $room;
            }
        }
        $pipeline->hSet($this->getNodeSidRoomsKey($nodeId), $sid, Json::encode($this->normalizeRooms($businessRooms)));
        $pipeline->expire($this->getNodeSidRoomsKey($nodeId), $this->indexTtlSeconds);
    }

    private function pipelineSyncRoomSidsField(object $pipeline, string $nodeId, string $roomHash, string $room): void
    {
        $sids = array_keys($this->roomSids[$this->getLocalRoomKey($room)] ?? []);
        if ($sids === []) {
            $pipeline->hDel($this->getNodeRoomSidsKey($nodeId), $roomHash);
            return;
        }

        $pipeline->hSet($this->getNodeRoomSidsKey($nodeId), $roomHash, Json::encode($this->normalizeStringList($sids)));
        $pipeline->expire($this->getNodeRoomSidsKey($nodeId), $this->indexTtlSeconds);
    }

    private function runRedisWrite(string $event, callable $write): void
    {
        try {
            $write();
        } catch (Throwable $throwable) {
            $this->indexDirty = true;
            $this->logger->warning(sprintf(
                'socketioRouteIndex event=%sFailed namespace=%s error=%s',
                $event,
                $this->nsp->getNamespace(),
                $this->formatThrowable($throwable)
            ));
        }
    }

    /**
     * Rebuild this worker node's Redis route index from local memory.
     *
     * Redis hashes do not have field-level TTL. If a previous delete/update failed,
     * simply renewing the hash key can keep stale fields alive. Dirty rebuild first
     * removes this node from every room hash currently recorded in Redis, drops the
     * node hash keys, then writes the current in-memory index back with short TTLs.
     *
     * @param string[] $businessRooms
     * @param string[] $sids
     */
    private function rebuildLocalRouteIndex(string $nodeId, int $ttl, array $businessRooms, array $sids): void
    {
        $oldRoomHashes = $this->normalizeStringList((array) $this->redis->hKeys($this->getNodeRoomSidsKey($nodeId)));
        $this->pipeline($this->redis, function ($pipeline) use ($nodeId, $ttl, $oldRoomHashes, $businessRooms, $sids) {
            foreach ($oldRoomHashes as $roomHash) {
                $pipeline->sRem($this->getRoomNodesKeyByHash($roomHash), $nodeId);
                $pipeline->expire($this->getRoomNodesKeyByHash($roomHash), $ttl);
            }

            $pipeline->del($this->getNodeRoomSidsKey($nodeId));
            $pipeline->del($this->getNodeSidRoomsKey($nodeId));

            foreach ($businessRooms as $room) {
                $roomHash = $this->hashValue($room);
                $pipeline->sAdd($this->getRoomNodesKeyByHash($roomHash), $nodeId);
                $pipeline->expire($this->getRoomNodesKeyByHash($roomHash), $ttl);
                $this->pipelineSyncRoomSidsField($pipeline, $nodeId, $roomHash, $room);
            }

            foreach ($sids as $sid) {
                $this->pipelineSyncSidRoomsField($pipeline, $nodeId, (string) $sid);
            }
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

    private function refreshNodeHeartbeatIfDue(): void
    {
        $nowMs = $this->nowMs();
        if ($this->nextHeartbeatRefreshAtMs > $nowMs) {
            return;
        }
        $this->refreshNodeHeartbeat();
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
        $this->nextHeartbeatRefreshAtMs = $nowMs + max(1000, (int) floor($this->nodeHeartbeatIntervalMs / 2));
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

    private function getRoomNodeIds(string $roomHash): array
    {
        $roomNodesKey = $this->getRoomNodesKeyByHash($roomHash);
        $nodeIds = $this->normalizeStringList((array) $this->redis->sMembers($roomNodesKey));
        if ($nodeIds === []) {
            return [];
        }

        $active = [];
        $stale = [];
        foreach ($nodeIds as $nodeId) {
            if ($nodeId === $this->getNodeId() || $this->isNodeAlive($nodeId)) {
                $active[$nodeId] = true;
                continue;
            }
            $stale[] = $nodeId;
        }

        if ($stale !== []) {
            $ttl = $this->indexTtlSeconds;
            $this->pipeline($this->redis, static function ($pipeline) use ($roomNodesKey, $stale, $ttl) {
                foreach ($stale as $nodeId) {
                    $pipeline->sRem($roomNodesKey, $nodeId);
                }
                $pipeline->expire($roomNodesKey, $ttl);
            });
        }
        return array_keys($active);
    }

    private function acquireCleanupLock(int $bucket): bool
    {
        return (bool) $this->redis->set($this->getCleanupLockKey($bucket), $this->getNodeId(), [
            'nx',
            'ex' => min(self::MAX_CLEANUP_LOCK_TTL_SECONDS, max(5, (int) ceil($this->nodeCleanupIntervalMs / 1000))),
        ]);
    }

    private function refreshQueueLeaseIfDue(string $queueKey, int $lane): void
    {
        $nowMs = $this->nowMs();
        if (($this->nextQueueLeaseRefreshAtMs[$lane] ?? 0) > $nowMs) {
            return;
        }

        try {
            if ((int) $this->queueRedis->lLen($queueKey) <= 0) {
                return;
            }
            $this->queueRedis->expire($queueKey, $this->queueTtlSeconds);
            $this->nextQueueLeaseRefreshAtMs[$lane] = $nowMs + max(1000, (int) floor($this->queueTtlSeconds * 1000 / 2));
        } catch (Throwable $throwable) {
            $this->logger->warning(sprintf(
                'socketioNodeQueue event=refreshLeaseFailed namespace=%s error=%s',
                $this->nsp->getNamespace(),
                $this->formatThrowable($throwable)
            ));
        }
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
     * @param array<int|string, mixed> $values
     * @return string[]
     */
    private function normalizeStringList(array $values): array
    {
        $normalized = [];
        foreach ($values as $value) {
            $value = (string) $value;
            if ($value !== '') {
                $normalized[$value] = $value;
            }
        }
        return array_values($normalized);
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

    private function decodeStringList(string $json): array
    {
        try {
            $data = Json::decode($json);
        } catch (Throwable) {
            return [];
        }
        return is_array($data) ? $this->normalizeStringList($data) : [];
    }

    private function getBusinessRooms(): array
    {
        $rooms = [];
        foreach ($this->sidRooms as $sid => $sidRooms) {
            foreach ($sidRooms as $room) {
                if (! DistributedSidCodec::isSelfRoom((string) $sid, $room)) {
                    $rooms[$this->getLocalRoomKey($room)] = $room;
                }
            }
        }
        return array_values($rooms);
    }

    private function getLocalRoomKey(string $room): string
    {
        return 'room:' . $room;
    }

    private function extractRooms(array $opts): array
    {
        $rooms = data_get($opts, 'rooms', []);
        if (is_array($rooms) && $rooms !== []) {
            $normalizedRooms = $this->normalizeRooms($rooms);
            if ($normalizedRooms !== []) {
                return $normalizedRooms;
            }
        }

        $room = data_get($opts, 'room');
        return $room === null ? [] : $this->normalizeRooms([$room]);
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

    private function getRoomNodesKeyByHash(string $roomHash): string
    {
        return implode(':', [
            $this->redisPrefix,
            'room_nodes',
            $this->getNamespaceHash(),
            $roomHash,
        ]);
    }

    private function getNodeRoomSidsKey(string $nodeId): string
    {
        return implode(':', [
            $this->redisPrefix,
            'node_room_sids',
            $this->getNamespaceHash(),
            $nodeId,
        ]);
    }

    private function getNodeSidRoomsKey(string $nodeId): string
    {
        return implode(':', [
            $this->redisPrefix,
            'node_sid_rooms',
            $this->getNamespaceHash(),
            $nodeId,
        ]);
    }

    private function getNodesKey(int $bucket): string
    {
        return implode(':', [
            $this->redisPrefix,
            'nodes',
            (string) $bucket,
        ]);
    }

    private function getNodeQueueKey(string $nodeId, int $lane): string
    {
        return implode(':', [
            $this->redisPrefix,
            'node_queue',
            $this->getNamespaceHash(),
            $nodeId,
            (string) $lane,
        ]);
    }

    private function getCleanupLockKey(int $bucket): string
    {
        return implode(':', [
            $this->redisPrefix,
            'cleanup_lock',
            (string) $bucket,
        ]);
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
        return 'local-' . $this->getPid();
    }

    private function getNodeId(): string
    {
        return DistributedSidCodec::buildNodeId($this->getServerId(), $this->getPid());
    }

    private function getPid(): int
    {
        $pid = getmypid();
        return $pid === false ? 0 : $pid;
    }

    private function hashValue(string $value): string
    {
        return sha1($value);
    }

    private function stableModulo(string $value, int $modulo): int
    {
        return (int) (sprintf('%u', crc32($value)) % $modulo);
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
