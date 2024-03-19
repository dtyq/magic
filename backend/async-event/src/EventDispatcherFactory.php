<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent;

use Dtyq\AsyncEvent\Kernel\Driver\ListenerAsyncDriverFactory;
use Dtyq\AsyncEvent\Kernel\Service\AsyncEventService;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\ListenerProviderInterface;

class EventDispatcherFactory
{
    public function __invoke(ContainerInterface $container): AsyncEventDispatcher
    {
        $listeners = $container->get(ListenerProviderInterface::class);
        $asyncEventService = $container->get(AsyncEventService::class);
        $listenerAsyncDriverFactory = $container->get(ListenerAsyncDriverFactory::class);
        return new AsyncEventDispatcher($listeners, $asyncEventService, $listenerAsyncDriverFactory);
    }
}
