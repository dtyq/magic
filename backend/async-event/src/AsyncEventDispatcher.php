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
        $asyncListeners = [];
        foreach ($this->listeners->getListenersForEvent($event) as $listener) {
            $listenerName = $this->getListenerName($listener);
            if (isset($this->asyncListeners[$listenerName]) || $listener instanceof AsyncListenerInterface) {
                $asyncListeners[$listenerName] = $listener;
            } else {
                $syncListeners[$listenerName] = $listener;
            }
        }

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

        // 投递异步事件
        foreach ($asyncListeners as $listenerName => $listener) {
            try {
                // 保证先落库后投递
                $eventRecord = $this->asyncEventService->buildAsyncEventData($eventName, $listenerName, $event);
                $eventModel = $this->asyncEventService->create($eventRecord);
                $this->resolveDriver($listenerName)->publish($eventModel, $event, $listener);
            } catch (Throwable $throwable) {
                // 保证其他异步事件可以继续投递
                LogUtil::dump(1, $listenerName, $eventName, $throwable);
            }
        }

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
        /** @var AsyncListener|null $annotation */
        $annotation = $this->asyncListeners[$listenerName] ?? null;
        $driverKey = ($annotation instanceof AsyncListener && $annotation->driver !== '')
            ? $annotation->driver
            : '';

        if (! isset($this->driverCache[$driverKey])) {
            $this->driverCache[$driverKey] = $this->listenerAsyncDriverFactory->create($driverKey ?: null);
        }

        return $this->driverCache[$driverKey];
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
