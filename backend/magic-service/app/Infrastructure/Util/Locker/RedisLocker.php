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
     * @param int $expire 过期时间，秒
     */
    public function spinLock(string $name, string $owner, int $expire = 10): bool
    {
        try {
            $key = $this->getLockKey($name);
            $timeSpace = 1000 * 10; // 每 10 毫秒尝试一次
            $microTime = $expire * 1000 * 1000; // 转换为微秒
            $time = 0;
            while (! $this->redis->set($key, $owner, ['NX', 'EX' => $expire])) {
                usleep($timeSpace);
                $time += $timeSpace;
                if ($time >= $microTime) {
                    return false;
                }
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
