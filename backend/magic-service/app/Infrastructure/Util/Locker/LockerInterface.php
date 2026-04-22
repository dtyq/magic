<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Locker;

interface LockerInterface
{
    /**
     * 获取互斥锁
     * @param string $name 锁的名称，指定锁的名称
     * @param string $owner 锁的所有者，指定锁的唯一标识，判断错误释放
     * @param int $expire 过期时间，秒
     */
    public function mutexLock(string $name, string $owner, int $expire = 180): bool;

    /**
     * 自旋锁
     * @param string $name 锁的名称，指定锁的名称
     * @param string $owner 锁的所有者，指定锁的唯一标识，避免错误释放
     * @param int $expire 锁的过期时间，秒
     * @param null|int $waitTimeout 最大等待时间，秒；不传时默认等于 $expire
     */
    public function spinLock(string $name, string $owner, int $expire = 10, ?int $waitTimeout = null): bool;

    /**
     * 释放锁
     * @param string $name 锁的名称，指定锁的名称
     * @param string $owner 锁的所有者，指定锁的唯一标识，判断错误释放
     */
    public function release(string $name, string $owner): bool;
}
