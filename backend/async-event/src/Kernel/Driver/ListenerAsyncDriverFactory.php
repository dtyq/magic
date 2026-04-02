<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Driver;

use Hyperf\Context\ApplicationContext;

class ListenerAsyncDriverFactory
{
    /**
     * @param null|string $driver 驱动标识，为空时读取全局配置 async_event.listener_exec_driver
     */
    public function create(?string $driver = null): ListenerAsyncDriverInterface
    {
        $container = ApplicationContext::getContainer();
        $driver = $driver ?: config('async_event.listener_exec_driver', 'coroutine');
        $class = match ($driver) {
            'queue_amqp' => QueueAMQPListenerAsyncDriver::class,
            default => CoroutineListenerAsyncDriver::class,
        };
        return $container->get($class);
    }
}
