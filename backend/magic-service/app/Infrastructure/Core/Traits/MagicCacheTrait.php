<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Traits;

use Hyperf\Cache\Driver\DriverInterface;
use Hyperf\Cache\Driver\MemoryDriver;
use Hyperf\Context\ApplicationContext;
use Throwable;

trait MagicCacheTrait
{
    /**
     * 缓存对象属性的下划线和驼峰命名，避免频繁计算.
     */
    protected static ?DriverInterface $propertyCacheDriver = null;

    /**
     * 获取缓存池实例.
     */
    protected function getDriver(): DriverInterface
    {
        if (! self::$propertyCacheDriver instanceof DriverInterface) {
            self::$propertyCacheDriver = new MemoryDriver(ApplicationContext::getContainer(), [
                'prefix' => 'magic-field-camelize:',
                'skip_cache_results' => [null, '', []],
                // 128M
                'size' => 128 * 1024 * 1024,
                'throw_when_size_exceeded' => true,
            ], );
        }
        return self::$propertyCacheDriver;
    }

    /**
     * 类的属性在框架运行时是不变的，所以这里使用缓存，避免重复计算.
     * 如果hasContainer是 false，则说明没有使用容器，不查询缓存.
     */
    protected function getUnCamelizeValueFromCache(string $key): string
    {
        $cacheDriver = $this->getDriver();
        $cacheKey = 'function_un_camelize_' . $key;
        try {
            $value = $cacheDriver->get($cacheKey);
            if ($value) {
                return $value;
            }

            $value = un_camelize($key);
            $cacheDriver->set($cacheKey, $value);
            return $value;
        } catch (Throwable $exception) {
            echo 'error:getCamelizeValueFromCache:' . $exception->getMessage();
            return un_camelize($key);
        }
    }

    /**
     * 类的属性在框架运行时是不变的，所以这里使用缓存，避免重复计算.
     */
    protected function getCamelizeValueFromCache(string $key): string
    {
        $cacheDriver = $this->getDriver();
        $cacheKey = 'function_camelize_' . $key;
        try {
            $value = $cacheDriver->get($cacheKey);
            if ($value) {
                return $value;
            }
            $value = camelize($key);
            $cacheDriver->set($cacheKey, $value);
            return $value;
        } catch (Throwable $exception) {
            echo 'error:getCamelizeValueFromCache:' . $exception->getMessage();
            return camelize($key);
        }
    }
}
