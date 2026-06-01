<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\SocketIOServer\Command;

use Hyperf\Command\Command;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

use function Hyperf\Support\env;

/**
 * 精确清理 Socket.IO v2 Redis 路由索引。
 *
 * v2 key 不再支持按 prefix 扫描清理：索引被刻意打散到 room / node / sid / bucket / lane
 * 对应的 Redis Cluster slot，用来复用多 master 自动路由能力并削弱热点 key。
 * 运维清理必须提供精确目标，避免一次 scan/del 反过来打爆 Redis。
 */
class RemoveRedisGarbage extends Command
{
    protected string $redisPrefix = 'magicChat:SocketIo:RedisAdapter:v2';

    protected string $connection = 'default';

    protected string $queueConnection = 'socketio_queue';

    protected int $nodeBucketCount = 128;

    protected int $queueLaneCount = 8;

    private RedisProxy $redis;

    private RedisProxy $queueRedis;

    public function __construct(private RedisFactory $factory)
    {
        parent::__construct('socketio:clear');
        $this->queueConnection = (string) env('SOCKETIO_REDIS_QUEUE_CONNECTION', $this->queueConnection);
        $this->nodeBucketCount = max(1, (int) env('SOCKETIO_NODE_BUCKET_COUNT', $this->nodeBucketCount));
        $this->queueLaneCount = max(1, (int) env('SOCKETIO_QUEUE_LANE_COUNT', $this->queueLaneCount));
    }

    public function handle(): int
    {
        $namespace = (string) $this->input->getArgument('namespace');
        $nodeId = (string) ($this->input->getOption('node-id') ?? '');
        $serverId = (string) ($this->input->getOption('server-id') ?? '');
        $routeNodeId = $nodeId !== '' ? $nodeId : $serverId;
        $room = (string) ($this->input->getOption('room') ?? '');
        $sid = (string) ($this->input->getOption('sid') ?? '');
        $force = (bool) $this->input->getOption('force');

        if ($namespace === '') {
            $this->output->error('namespace is required. Refuse to scan socketio keys.');
            return 1;
        }
        if ($routeNodeId === '' && $room === '' && $sid === '') {
            $this->output->error('Provide --node-id, --server-id, --room, or --sid. Prefix scan cleanup is not supported.');
            return 1;
        }
        if (($room !== '' || $sid !== '') && ! $force) {
            $this->output->error('Exact --room/--sid cleanup may affect live sockets. Use --force only after confirming the target is stale.');
            return 1;
        }

        $this->redis = $this->factory->get($this->connection);
        try {
            $this->queueRedis = $this->factory->get($this->queueConnection);
        } catch (Throwable) {
            $this->queueRedis = $this->redis;
        }

        if ($routeNodeId !== '') {
            $this->clearNode($namespace, $routeNodeId);
        }
        if ($room !== '') {
            $this->clearRoom($namespace, $room);
        }
        if ($sid !== '') {
            $this->clearSid($namespace, $sid);
        }

        $this->output->success('socketio exact cleanup finished.');
        return 0;
    }

    protected function getArguments(): array
    {
        return [
            ['namespace', InputArgument::REQUIRED, 'Socket.IO namespace, for example /im.'],
        ];
    }

    protected function getOptions(): array
    {
        return [
            ['node-id', null, InputOption::VALUE_OPTIONAL, 'Exact route nodeId to clean.'],
            ['server-id', null, InputOption::VALUE_OPTIONAL, 'Backward-compatible alias of --node-id.'],
            ['room', null, InputOption::VALUE_OPTIONAL, 'Exact room id to clean.'],
            ['sid', null, InputOption::VALUE_OPTIONAL, 'Exact sid to clean.'],
            ['force', 'f', InputOption::VALUE_NONE, 'Allow exact room/sid cleanup after confirming the target is stale.'],
        ];
    }

    private function clearNode(string $namespace, string $nodeId): void
    {
        $namespaceHash = $this->hashValue($namespace);
        $roomHashes = (array) $this->redis->sMembers($this->getNodeRoomsKey($namespaceHash, $nodeId));
        $sids = (array) $this->redis->sMembers($this->getNodeSidsKey($namespaceHash, $nodeId));

        $this->pipeline($this->redis, function ($pipeline) use ($namespaceHash, $nodeId, $roomHashes, $sids) {
            foreach ($roomHashes as $roomHash) {
                $roomHash = (string) $roomHash;
                $pipeline->sRem($this->getRoomNodesKey($namespaceHash, $roomHash), $nodeId);
                $pipeline->del($this->getNodeRoomSidsKey($namespaceHash, $nodeId, $roomHash));
            }

            foreach ($sids as $sid) {
                $sid = (string) $sid;
                $pipeline->del($this->getSidRoomsKey($namespaceHash, $sid));
                $pipeline->del($this->getSidNodeKey($namespaceHash, $sid));
            }
            $pipeline->del($this->getNodeRoomsKey($namespaceHash, $nodeId));
            $pipeline->del($this->getNodeSidsKey($namespaceHash, $nodeId));
            $pipeline->zRem($this->getNodesKey($this->getNodeBucket($nodeId)), $nodeId);
        });

        $this->pipeline($this->queueRedis, function ($pipeline) use ($namespaceHash, $nodeId) {
            for ($lane = 0; $lane < $this->queueLaneCount; ++$lane) {
                $pipeline->del($this->getNodeQueueKey($namespaceHash, $nodeId, $lane));
            }
        });
    }

    private function clearRoom(string $namespace, string $room): void
    {
        $namespaceHash = $this->hashValue($namespace);
        $roomHash = $this->hashValue($room);
        $nodeIds = (array) $this->redis->sMembers($this->getRoomNodesKey($namespaceHash, $roomHash));
        $this->pipeline($this->redis, function ($pipeline) use ($namespaceHash, $roomHash, $nodeIds) {
            foreach ($nodeIds as $nodeId) {
                $nodeId = (string) $nodeId;
                $pipeline->sRem($this->getNodeRoomsKey($namespaceHash, $nodeId), $roomHash);
                $pipeline->del($this->getNodeRoomSidsKey($namespaceHash, $nodeId, $roomHash));
            }
            $pipeline->del($this->getRoomNodesKey($namespaceHash, $roomHash));
        });
    }

    private function clearSid(string $namespace, string $sid): void
    {
        $namespaceHash = $this->hashValue($namespace);
        $sidRoomsKey = $this->getSidRoomsKey($namespaceHash, $sid);
        $rooms = (array) $this->redis->sMembers($sidRoomsKey);
        $nodeId = (string) $this->redis->get($this->getSidNodeKey($namespaceHash, $sid));
        if ($nodeId === '') {
            $nodeId = $this->extractServerIdFromSid($sid);
        }
        $this->pipeline($this->redis, function ($pipeline) use ($namespaceHash, $nodeId, $rooms, $sid, $sidRoomsKey) {
            foreach ($rooms as $room) {
                if ($nodeId !== '') {
                    $pipeline->sRem($this->getNodeRoomSidsKey($namespaceHash, $nodeId, $this->hashValue((string) $room)), $sid);
                }
            }
            if ($nodeId !== '') {
                $pipeline->sRem($this->getNodeSidsKey($namespaceHash, $nodeId), $sid);
            }
            $pipeline->del($sidRoomsKey);
            $pipeline->del($this->getSidNodeKey($namespaceHash, $sid));
        });
    }

    private function pipeline(RedisProxy $redis, callable $commands): mixed
    {
        $pipeline = $redis->pipeline();
        $commands($pipeline);
        return $pipeline->exec();
    }

    private function getRoomNodesKey(string $namespaceHash, string $roomHash): string
    {
        return $this->makeClusterKey(
            'room_nodes:' . $namespaceHash . ':' . $roomHash,
            'room_nodes',
            $namespaceHash,
            $roomHash
        );
    }

    private function getNodeRoomsKey(string $namespaceHash, string $serverId): string
    {
        return $this->makeClusterKey(
            'node:' . $namespaceHash . ':' . $serverId,
            'node_rooms',
            $namespaceHash,
            $serverId
        );
    }

    private function getNodeSidsKey(string $namespaceHash, string $serverId): string
    {
        return $this->makeClusterKey(
            'node:' . $namespaceHash . ':' . $serverId,
            'node_sids',
            $namespaceHash,
            $serverId
        );
    }

    private function getNodeRoomSidsKey(string $namespaceHash, string $serverId, string $roomHash): string
    {
        return $this->makeClusterKey(
            'node_room_sids:' . $namespaceHash . ':' . $serverId . ':' . $roomHash,
            'node_room_sids',
            $namespaceHash,
            $serverId,
            $roomHash
        );
    }

    private function getSidRoomsKey(string $namespaceHash, string $sid): string
    {
        $sidHash = $this->hashValue($sid);
        return $this->makeClusterKey(
            'sid:' . $namespaceHash . ':' . $sidHash,
            'sid_rooms',
            $namespaceHash,
            $sidHash
        );
    }

    private function getSidNodeKey(string $namespaceHash, string $sid): string
    {
        $sidHash = $this->hashValue($sid);
        return $this->makeClusterKey(
            'sid:' . $namespaceHash . ':' . $sidHash,
            'sid_node',
            $namespaceHash,
            $sidHash
        );
    }

    private function getNodesKey(int $bucket): string
    {
        return $this->makeClusterKey('nodes:' . $bucket, 'nodes', (string) $bucket);
    }

    private function getNodeQueueKey(string $namespaceHash, string $serverId, int $lane): string
    {
        return $this->makeClusterKey(
            'node_queue:' . $namespaceHash . ':' . $serverId . ':' . $lane,
            'node_queue',
            $namespaceHash,
            $serverId,
            (string) $lane
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
        // 与 RedisAdapterV2 保持一致：高基数 route tag 让 Redis Cluster 按业务实体分散到多 master。
        return '{socketio:' . $this->hashValue($routeSeed) . '}';
    }

    private function getNodeBucket(string $serverId): int
    {
        return sprintf('%u', crc32($serverId)) % $this->nodeBucketCount;
    }

    private function extractServerIdFromSid(string $sid): string
    {
        $parts = explode('#', $sid, 2);
        return count($parts) === 2 ? $parts[0] : '';
    }

    private function hashValue(string $value): string
    {
        return sha1($value);
    }
}
