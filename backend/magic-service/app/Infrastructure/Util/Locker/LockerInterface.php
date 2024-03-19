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
     * @param int $expire 过期时间，单位:秒
     */
    public function spinLock(string $name, string $owner, int $expire = 10): bool;

    /**
     * 释放锁
     * @param string $name 锁的名称，指定锁的名称
     * @param string $owner 锁的所有者，指定锁的唯一标识，判断错误释放
     */
    public function release(string $name, string $owner): bool;
}
