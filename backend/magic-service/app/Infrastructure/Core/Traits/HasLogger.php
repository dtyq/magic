<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Traits;

use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\NotFoundExceptionInterface;
use Psr\Log\LoggerInterface;

/**
 * @property LoggerInterface $logger
 */
trait HasLogger
{
    /**
     * 使用 __get 自动获取 logger 属性，实现懒加载.
     * @param mixed $name
     */
    public function __get($name)
    {
        if ($name === 'logger') {
            try {
                return $this->getLogger();
            } catch (ContainerExceptionInterface) {
            }
        }
        return null;
    }

    /**
     * 使用 __set 自动设置 logger 属性.
     */
    public function __set(string $name, mixed $value): void
    {
        if ($name === 'logger' && $value instanceof LoggerInterface) {
            $class = static::class;
            $this->loggerCache($class, $value);
        }
    }

    /**
     * 使用 __isset 检查 logger 属性是否存在.
     */
    public function __isset(string $name): bool
    {
        return $name === 'logger';
    }

    /**
     * 获取日志对象，支持懒加载和自定义分组.
     *
     * @param null|string $group 如果传入，则获取指定分组的日志对象；如果不传，默认使用 $this->loggerGroup 或类名
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     */
    protected function log(?string $group = null): LoggerInterface
    {
        return $this->getLogger($group);
    }

    /**
     * 获取日志对象，支持懒加载和自定义分组.
     *
     * @param null|string $group 如果传入，则获取指定分组的日志对象；如果不传，默认使用 $this->loggerGroup 或类名
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     */
    protected function getLogger(?string $group = null): LoggerInterface
    {
        if ($group !== null) {
            return ApplicationContext::getContainer()->get(LoggerFactory::class)->get($group);
        }

        $class = static::class;
        $logger = $this->loggerCache($class);
        if (! $logger instanceof LoggerInterface) {
            $defaultGroup = property_exists($this, 'loggerGroup') ? $this->loggerGroup : $class;
            $logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get($defaultGroup);
            $this->loggerCache($class, $logger);
        }

        return $logger;
    }

    /**
     * 使用方法内 static 缓存 logger（避免 readonly class 无法引入 trait 静态属性的问题）.
     */
    private function loggerCache(string $class, ?LoggerInterface $set = null): ?LoggerInterface
    {
        /** @var array<string, LoggerInterface> $instances */
        static $instances = [];

        if ($set !== null) {
            $instances[$class] = $set;
            return $set;
        }

        return $instances[$class] ?? null;
    }
}
