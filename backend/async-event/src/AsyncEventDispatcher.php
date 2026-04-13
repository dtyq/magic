<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent;

use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\AsyncEvent\Kernel\Driver\ListenerAsyncDriverFactory;
use Dtyq\AsyncEvent\Kernel\Driver\ListenerAsyncDriverInterface;
use Dtyq\AsyncEvent\Kernel\Service\AsyncEventService;
use Dtyq\AsyncEvent\Kernel\Utils\LogUtil;
use Hyperf\Di\Annotation\AnnotationCollector;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\EventDispatcher\ListenerProviderInterface;
use Psr\EventDispatcher\StoppableEventInterface;
use Throwable;

class AsyncEventDispatcher implements EventDispatcherInterface
{
    private array $asyncListeners;

    private ListenerProviderInterface $listeners;

    private AsyncEventService $asyncEventService;

    private ListenerAsyncDriverFactory $listenerAsyncDriverFactory;

    /** @var ListenerAsyncDriverInterface[] 按 driver 标识缓存已创建的驱动实例 */
    private array $driverCache = [];

    public function __construct(
        ListenerProviderInterface $listeners,
        AsyncEventService $asyncEventService,
        ListenerAsyncDriverFactory $listenerAsyncDriverFactory,
    ) {
        $this->listeners = $listeners;
        $this->asyncEventService = $asyncEventService;
        $this->listenerAsyncDriverFactory = $listenerAsyncDriverFactory;

        $this->asyncListeners = AnnotationCollector::getClassesByAnnotation(AsyncListener::class);
    }

    public function dispatch(object $event): object
    {
        $eventName = get_class($event);

        $syncListeners = [];
        $asyncNoWaitListeners = [];
        $asyncWaitListeners = [];
        foreach ($this->listeners->getListenersForEvent($event) as $listener) {
            $listenerName = $this->getListenerName($listener);
            if (isset($this->asyncListeners[$listenerName]) || $listener instanceof AsyncListenerInterface) {
                $annotation = $this->asyncListeners[$listenerName] ?? null;
                if ($annotation instanceof AsyncListener && ! $annotation->waitForSync) {
                    $asyncNoWaitListeners[$listenerName] = $listener;
                } else {
                    $asyncWaitListeners[$listenerName] = $listener;
                }
            } else {
                $syncListeners[$listenerName] = $listener;
            }
        }

        // 不等待同步监听的异步事件优先投递，使用 immediate 模式立即开启新协程并发执行
        $this->publishAsyncListeners($eventName, $asyncNoWaitListeners, $event, true);

        // 记录同步异常，保证异步事件可以触发执行
        $lastException = null;

        // 直接同步执行
        foreach ($syncListeners as $listenerName => $listener) {
            $exception = null;
            try {
                $listener($event);
            } catch (Throwable $throwable) {
                $exception = $throwable;
                $lastException = $throwable;
                break;
            } finally {
                LogUtil::dump(0, $listenerName, $eventName, $exception);
            }
            if ($event instanceof StoppableEventInterface && $event->isPropagationStopped()) {
                break;
            }
        }

        // 等待同步监听完成后再投递的异步事件
        $this->publishAsyncListeners($eventName, $asyncWaitListeners, $event);

        if ($lastException) {
            throw $lastException;
        }

        return $event;
    }

    /**
     * 根据 listener 注解上的 driver 字段解析对应驱动，driver 为空时使用全局配置。
     * 同一进程内按 driver key 缓存实例。
     */
    private function resolveDriver(string $listenerName): ListenerAsyncDriverInterface
    {
        $driverKey = $this->resolveDriverKey($listenerName);

        if (! isset($this->driverCache[$driverKey])) {
            $this->driverCache[$driverKey] = $this->listenerAsyncDriverFactory->create($driverKey ?: null);
        }

        return $this->driverCache[$driverKey];
    }

    /**
     * 返回 listener 实际使用的 driver 标识。
     * 注解指定了 driver 则校验合法性，非法时回退到全局配置并打印警告。
     */
    private function resolveDriverKey(string $listenerName): string
    {
        /** @var AsyncListener|null $annotation */
        $annotation = $this->asyncListeners[$listenerName] ?? null;
        if ($annotation instanceof AsyncListener && $annotation->driver !== ''
            && in_array($annotation->driver, ListenerAsyncDriverFactory::VALID_DRIVERS, true)
        ) {
            return $annotation->driver;
        }
        return config('async_event.listener_exec_driver', 'coroutine');
    }

    /**
     * 批量投递异步事件，保证先落库后投递，单条异常不影响其他条目继续投递。
     */
    private function publishAsyncListeners(string $eventName, array $listeners, object $event, bool $immediate = false): void
    {
        foreach ($listeners as $listenerName => $listener) {
            try {
                $eventRecord = $this->asyncEventService->buildAsyncEventData($eventName, $listenerName, $event);
                $eventModel = $this->asyncEventService->create($eventRecord);
                $this->resolveDriver($listenerName)->publish($eventModel, $event, $listener, $immediate);
            } catch (Throwable $throwable) {
                LogUtil::dump(1, $listenerName, $eventName, $throwable, ['driver' => $this->resolveDriverKey($listenerName)]);
            }
        }
    }

    private function getListenerName($listener): string
    {
        $listenerName = '[ERROR TYPE]';
        if (is_array($listener)) {
            $listenerName = is_string($listener[0]) ? $listener[0] : get_class($listener[0]);
        } elseif (is_string($listener)) {
            $listenerName = $listener;
        } elseif (is_object($listener)) {
            $listenerName = get_class($listener);
        }
        return $listenerName;
    }
}
