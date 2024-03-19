<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Utils;

use Dtyq\AsyncEvent\Kernel\Utils\Locker\RedisLocker;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class Locker
{
    private RedisLocker $locker;

    private LoggerInterface $logger;

    public function __construct(RedisLocker $locker, LoggerFactory $loggerFactory)
    {
        $this->locker = $locker;
        $this->logger = $loggerFactory->get(get_class());
    }

    /**
     * 获取锁.
     */
    public function acquire(string $name, string $owner, int $expire = 180): bool
    {
        $result = $this->locker->acquire($name, $owner, $expire);
        $this->logger->debug("获取锁[{$name}] {$result}");
        return $result;
    }

    /**
     * 释放锁.
     */
    public function release(string $name, string $owner): bool
    {
        $result = $this->locker->release($name, $owner);
        $this->logger->debug("释放锁[{$name}] {$result}");
        return $result;
    }

    /**
     * 非阻塞锁.
     */
    public function get(callable $callable, string $name, ?string $owner = null, int $expire = 180)
    {
        if (is_null($owner)) {
            $owner = uniqid();
        }

        if ($this->acquire($name, $owner, $expire)) {
            try {
                return $callable();
            } finally {
                $this->release($name, $owner);
            }
        }

        return null;
    }

    /**
     * 阻塞锁.
     */
    public function block(callable $callable, string $name, int $maxSeconds = 60, ?string $owner = null, int $expire = 180)
    {
        $startTime = time();

        if (is_null($owner)) {
            $owner = uniqid();
        }

        while (! $this->acquire($name, $owner, $expire)) {
            usleep(250 * 1000);

            if ((time() - $maxSeconds) >= $startTime) {
                return null;
            }
        }

        try {
            return $callable();
        } finally {
            $this->release($name, $owner);
        }
    }
}
