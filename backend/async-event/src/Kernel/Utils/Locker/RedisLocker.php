<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Utils\Locker;

use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;

class RedisLocker
{
    protected RedisProxy $redis;

    public function __construct(RedisFactory $redisFactory)
    {
        $this->redis = $redisFactory->get('default');
    }

    public function acquire(string $name, string $owner, int $expire = 180): bool
    {
        return $this->redis->set($this->_getLockKey($name), $owner, ['NX', 'EX' => $expire]);
    }

    public function release(string $name, string $owner): bool
    {
        $lua = <<<'EOT'
if redis.call("get",KEYS[1]) == ARGV[1] then
    return redis.call("del",KEYS[1])
else
    return 0
end
EOT;
        return boolval($this->redis->eval($lua, [$this->_getLockKey($name), $owner], 1));
    }

    private function _getLockKey(string $name): string
    {
        return "lock_{$name}";
    }
}
