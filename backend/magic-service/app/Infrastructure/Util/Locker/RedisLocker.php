<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Locker;

use App\Infrastructure\Util\Locker\Excpetion\LockException;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Throwable;

class RedisLocker implements LockerInterface
{
    protected RedisProxy $redis;

    public function __construct(RedisFactory $redisFactory)
    {
        $this->redis = $redisFactory->get('default');
    }

    /**
     * 获取互斥锁
     * @param string $name 锁的名称，指定锁的名称
     * @param string $owner 锁的所有者，指定锁的唯一标识，避免错误释放
     * @param int $expire 过期时间，秒
     */
    public function mutexLock(string $name, string $owner, int $expire = 180): bool
    {
        try {
            return $this->redis->set($this->getLockKey($name), $owner, ['NX', 'EX' => $expire]);
        } catch (Throwable) {
            throw new LockException();
        }
    }

    /**
     * 自旋锁
     * @param string $name 锁的名称，指定锁的名称
     * @param string $owner 锁的所有者，指定锁的唯一标识，避免错误释放
     * @param int $expire 锁的过期时间，秒
     * @param null|int $waitTimeout 最大等待时间，秒；不传时默认等于 $expire
     */
    public function spinLock(string $name, string $owner, int $expire = 10, ?int $waitTimeout = null): bool
    {
        try {
            $key = $this->getLockKey($name);
            $intervalUs = 1000 * 10; // retry every 10ms
            $deadline = microtime(true) + ($waitTimeout ?? $expire);
            while (! $this->redis->set($key, $owner, ['NX', 'EX' => $expire])) {
                if (microtime(true) >= $deadline) {
                    return false;
                }
                usleep($intervalUs);
            }
            return true;
        } catch (Throwable) {
            throw new LockException();
        }
    }

    public function release(string $name, string $owner): bool
    {
        try {
            $lua = <<<'EOT'
            if redis.call("get",KEYS[1]) == ARGV[1] then
                return redis.call("del",KEYS[1])
            else
                return 0
            end
            EOT;
            return (bool) $this->redis->eval($lua, [$this->getLockKey($name), $owner], 1);
        } catch (Throwable) {
            throw new LockException();
        }
    }

    private function getLockKey(string $name): string
    {
        return 'lock_' . $name;
    }
}
