<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\SocketIOServer\Room;

use App\Domain\Chat\Service\MessageContentProviderInterface;
use App\Infrastructure\Core\Traits\HasLogger;
use Hyperf\Context\ApplicationContext;
use Hyperf\Coordinator\Constants;
use Hyperf\Coordinator\CoordinatorManager;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Engine\WebSocket\Frame;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Hyperf\SocketIOServer\NamespaceInterface;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\WebSocketServer\Sender;
use Redis;
use Throwable;

use function Hyperf\Collection\data_get;
use function Hyperf\Support\retry;

class RedisAdapter implements AdapterInterface, EphemeralInterface
{
    use HasLogger;

    protected string $redisPrefix = 'magicChat:SocketIo:RedisAdapter';

    protected int $retryInterval = 1000;

    protected int $cleanUpExpiredInterval = 5000;

    /**
     * 每次清理过期 sid 的批大小，避免全量拉取造成 Redis/CPU 抖动。
     */
    protected int $cleanUpExpiredBatchSize = 1000;

    protected string $connection = 'default';

    protected \Hyperf\Redis\Redis|Redis|RedisProxy $redis;

    protected int $ttl = 0;

    protected ?MessageContentProviderInterface $messageContentProvider = null;

    public function __construct(RedisFactory $redis, protected Sender $sender, protected NamespaceInterface $nsp, protected SidProviderInterface $sidProvider)
    {
        $this->redis = $redis->get($this->connection);

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

        // 旧实现会按 room 次数重复 zAdd 同一个 sid，这里合并为一次过期写，减少 Redis 写放大。
        $expireAt = microtime(true) * 1000 + $this->ttl;
        $this->redis->multi();
        $this->redis->sAdd($this->getSidKey($sid), ...$rooms);
        foreach ($rooms as $room) {
            $this->redis->sAdd($this->getRoomKey($room), $sid);
        }
        if ($this->ttl > 0) {
            $this->redis->zAdd($this->getExpireKey(), $expireAt, $sid);
        }
        $this->redis->sAdd($this->getStatKey(), $sid);
        $this->redis->exec();
    }

    public function del(string $sid, string ...$rooms): void
    {
        if ($sid === '') {
            return;
        }

        if (count($rooms) === 0) {
            $clientRooms = $this->clientRooms($sid);
            if (! empty($clientRooms)) {
                $this->del($sid, ...$clientRooms);
            }
            // 即使 $clientRooms 为空，也要清理一些其他资源记录
            $this->redis->multi();
            $this->redis->del($this->getSidKey($sid));
            $this->redis->sRem($this->getStatKey(), $sid);
            $this->redis->zRem($this->getExpireKey(), $sid);
            $this->redis->exec();
            return;
        }

        $this->redis->multi();
        $this->redis->sRem($this->getSidKey($sid), ...$rooms);
        foreach ($rooms as $room) {
            $this->redis->sRem($this->getRoomKey($room), $sid);
        }
        $this->redis->exec();
    }

    public function broadcast($packet, $opts): void
    {
        $local = data_get($opts, 'flag.local', false);
        if ($local) {
            $this->doBroadcast($packet, $opts);
            return;
        }

        $this->publish($this->getChannelKey(), serialize([$packet, $opts]));
    }

    public function clients(string ...$rooms): array
    {
        $pushed = [];
        $result = [];
        if (! empty($rooms)) {
            foreach ($rooms as $room) {
                $sids = $this->redis->sMembers($this->getRoomKey($room));
                if (! $sids) {
                    continue;
                }
                foreach ($sids as $sid) {
                    if (isset($pushed[$sid])) {
                        continue;
                    }
                    $result[] = $sid;
                    $pushed[$sid] = true;
                }
            }
        } else {
            $sids = $this->redis->sMembers($this->getStatKey());
            foreach ($sids as $sid) {
                $result[] = $sid;
            }
        }
        return $result;
    }

    public function clientRooms(string $sid): array
    {
        return $this->redis->sMembers($this->getSidKey($sid));
    }

    public function subscribe()
    {
        Coroutine::create(function () {
            CoordinatorManager::until(Constants::WORKER_START)->yield();
            retry(PHP_INT_MAX, function () {
                try {
                    // swow 下 phpredis subscribe 可协程化使用。
                    $this->phpRedisSubscribe();
                } catch (Throwable $e) {
                    $this->logger->error(sprintf(
                        'event=phpRedisSubscribeFailed namespace=%s error=%s',
                        $this->nsp->getNamespace(),
                        $this->formatThrowable($e)
                    ));
                    throw $e;
                }
            }, $this->retryInterval);
        });
    }

    public function cleanUp(): void
    {
        $prefix = implode(':', [
            $this->redisPrefix,
            $this->nsp->getNamespace(),
        ]);
        $iterator = null;
        while (true) {
            $keys = $this->redis->scan($iterator, $prefix . '*');
            if ($keys === false) {
                return;
            }
            if (! empty($keys)) {
                $this->redis->del(...$keys);
            }
        }
    }

    public function cleanUpExpired(): void
    {
        Coroutine::create(function () {
            while (true) {
                if (CoordinatorManager::until(Constants::WORKER_EXIT)->yield($this->cleanUpExpiredInterval / 1000)) {
                    break;
                }
                $this->cleanUpExpiredOnce();
            }
        });
    }

    public function cleanUpExpiredOnce(): void
    {
        $cutoff = (string) (microtime(true) * 1000);

        while (true) {
            $sids = $this->redis->zRangeByScore($this->getExpireKey(), '-inf', $cutoff, [
                'limit' => [0, $this->cleanUpExpiredBatchSize],
            ]);

            if (empty($sids)) {
                return;
            }

            foreach ($sids as $sid) {
                // 统一走 disconnectSid 单一路径，避免“event + del + zRem”造成重复断链与重复清理写。
                $this->disconnectSid((string) $sid);
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
        if ($sid === '') {
            return;
        }

        if ($this->ttl > 0) {
            $this->redis->zAdd($this->getExpireKey(), microtime(true) * 1000 + $this->ttl, $sid);
        }
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
        // 即便 closeFd 失败也要清理路由关系，保证最终不会继续参与房间推送。
        $this->del($sid);
    }

    protected function publish(string $channel, string $message)
    {
        $this->redis->publish($channel, $message);
    }

    protected function doBroadcast($packet, $opts): void
    {
        $opts = is_array($opts) ? $opts : [];
        // 兼容 vendor 里 room 单值参数（例如 dismiss），避免误退化成全量广播。
        $rooms = $this->extractRooms($opts);
        $pushed = [];
        $except = data_get($opts, 'except', []);
        // except 预构建哈希集合，减少大房间广播时的线性 in_array 开销。
        $exceptSet = $this->buildExceptSet(is_array($except) ? $except : []);
        if (! empty($rooms)) {
            foreach ($rooms as $room) {
                $sids = $this->redis->sMembers($this->getRoomKey($room));
                foreach ($sids as $sid) {
                    $this->tryPush((string) $sid, $packet, $pushed, $opts, $exceptSet);
                }
            }
        } else {
            $sids = $this->redis->sMembers($this->getStatKey());
            foreach ($sids as $sid) {
                $this->tryPush((string) $sid, $packet, $pushed, $opts, $exceptSet);
            }
        }
    }

    protected function isLocal(string $sid): bool
    {
        return $this->sidProvider->isLocal($sid);
    }

    protected function getRoomKey(string $room): string
    {
        return implode(':', [
            $this->redisPrefix,
            $this->nsp->getNamespace(),
            'rooms',
            $room,
        ]);
    }

    protected function getStatKey(): string
    {
        return implode(':', [
            $this->redisPrefix,
            $this->nsp->getNamespace(),
            'stat',
        ]);
    }

    protected function getSidKey(string $sid): string
    {
        return implode(':', [
            $this->redisPrefix,
            $this->nsp->getNamespace(),
            'fds',
            $sid,
        ]);
    }

    protected function getChannelKey(): string
    {
        return implode(':', [
            $this->redisPrefix,
            $this->nsp->getNamespace(),
            'channel',
        ]);
    }

    protected function getExpireKey(): string
    {
        return implode(':', [
            $this->redisPrefix,
            $this->nsp->getNamespace(),
            'expire',
        ]);
    }

    protected function getFd(string $sid): int
    {
        return $this->sidProvider->getFd($sid);
    }

    private function tryPush(string $sid, string $packet, array &$pushed, array $opts, array $exceptSet): void
    {
        // O(1) 判定是否在 except 中，比 in_array 更稳定。
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

        if ($this->messageContentProvider !== null) {
            $actualPacket = $this->messageContentProvider->resolveActualPacket($packet);
        } else {
            $actualPacket = $packet;
        }
        $this->sender->pushFrame($fd, new Frame(payloadData: $actualPacket));
        $pushed[$fd] = true;
        $this->shouldClose($opts) && $this->closeFd($fd, $sid);
    }

    private function formatThrowable(Throwable $throwable): string
    {
        return (string) $throwable;
    }

    private function phpRedisSubscribe(): void
    {
        $redis = $this->redis;
        $callback = function ($redis, $chan, $msg) {
            Coroutine::create(function () use ($msg) {
                [$packet, $opts] = unserialize($msg, ['allowed_classes' => true]);
                $this->logSubscribePayloadObjectTypes($packet, $opts);
                $this->doBroadcast($packet, $opts);
            });
        };
        /* @phpstan-ignore-next-line */
        $redis->subscribe([$this->getChannelKey()], $callback);
    }

    /**
     * 记录订阅消息中的对象类型，仅做观测，不改变现有业务行为。
     */
    private function logSubscribePayloadObjectTypes(mixed $packet, mixed $opts): void
    {
        $types = [];
        $this->collectObjectTypes($packet, $types);
        $this->collectObjectTypes($opts, $types);

        if ($types === []) {
            return;
        }

        $this->logger->warning(sprintf(
            'sidGuard event=subscribePayloadObjectDetected namespace=%s classes=%s',
            $this->nsp->getNamespace(),
            implode(',', array_keys($types))
        ));
    }

    /**
     * 递归收集反序列化结果中的对象类型，限制深度与类型数避免极端 payload 扫描开销过大。
     *
     * @param array<string, true> $types
     */
    private function collectObjectTypes(mixed $value, array &$types, int $depth = 0): void
    {
        if ($depth >= 8 || count($types) >= 20) {
            return;
        }

        if (is_object($value)) {
            $types[$value::class] = true;
            return;
        }

        if (! is_array($value)) {
            return;
        }

        foreach ($value as $item) {
            if (count($types) >= 20) {
                return;
            }
            $this->collectObjectTypes($item, $types, $depth + 1);
        }
    }

    private function shouldClose(array $opts)
    {
        return data_get($opts, 'flag.close', false);
    }

    /**
     * 主动关闭 fd。失败时仅记录日志，由上层继续做 sid 路由清理。
     */
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

    /**
     * 兼容 opts.rooms 与 opts.room 两种传参。
     */
    private function extractRooms(array $opts): array
    {
        $rooms = data_get($opts, 'rooms', []);
        if (is_array($rooms) && ! empty($rooms)) {
            $normalizedRooms = [];
            foreach ($rooms as $room) {
                $room = (string) $room;
                if ($room !== '') {
                    $normalizedRooms[] = $room;
                }
            }
            if (! empty($normalizedRooms)) {
                return $normalizedRooms;
            }
        }

        // 回退兼容 room 单值写法，保证两种调用方式行为一致。
        $room = data_get($opts, 'room');
        if ($room === null) {
            return [];
        }

        $room = (string) $room;
        return $room === '' ? [] : [$room];
    }

    /**
     * 将 except 列表转为哈希集合，降低广播时查找开销。
     *
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
}
