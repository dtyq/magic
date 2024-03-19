<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Util;

use Dtyq\TaskScheduler\Exception\TaskSchedulerException;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Throwable;

class Locker
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
            throw new TaskSchedulerException('lock error');
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
            throw new TaskSchedulerException('release lock error');
        }
    }

    private function getLockKey(string $name): string
    {
        return 'task_scheduler_lock_' . $name;
    }
}
