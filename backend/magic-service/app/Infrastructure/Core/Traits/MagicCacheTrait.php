<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Traits;

trait MagicCacheTrait
{
    /**
     * 类的属性在框架运行时是不变的，所以这里使用进程内静态数组缓存，避免重复计算.
     * 转换是纯函数且 key 集合有限（属性名），不经缓存驱动，避免大 DTO 上"每对象 × 每属性"的驱动开销.
     */
    protected function getUnCamelizeValueFromCache(string $key): string
    {
        static $cache = [];
        return $cache[$key] ??= un_camelize($key);
    }

    /**
     * 类的属性在框架运行时是不变的，所以这里使用进程内静态数组缓存，避免重复计算.
     */
    protected function getCamelizeValueFromCache(string $key): string
    {
        static $cache = [];
        return $cache[$key] ??= camelize($key);
    }
}
