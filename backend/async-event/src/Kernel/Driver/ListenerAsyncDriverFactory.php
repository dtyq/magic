<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Driver;

use Hyperf\Context\ApplicationContext;

class ListenerAsyncDriverFactory
{
    public function create(): ListenerAsyncDriverInterface
    {
        $container = ApplicationContext::getContainer();
        $driver = config('async_event.listener_exec_driver', 'coroutine');
        $class = match ($driver) {
            'queue_amqp' => QueueAMQPListenerAsyncDriver::class,
            default => CoroutineListenerAsyncDriver::class,
        };
        return $container->get($class);
    }
}
