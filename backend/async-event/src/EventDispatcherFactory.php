<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent;

use Dtyq\AsyncEvent\Kernel\Service\AsyncEventService;
use Dtyq\AsyncEvent\Kernel\Utils\Locker;
use Hyperf\Contract\StdoutLoggerInterface;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\ListenerProviderInterface;

class EventDispatcherFactory
{
    public function __invoke(ContainerInterface $container): AsyncEventDispatcher
    {
        $listeners = $container->get(ListenerProviderInterface::class);
        $stdoutLogger = $container->get(StdoutLoggerInterface::class);
        $asyncEventService = $container->get(AsyncEventService::class);
        $locker = $container->get(Locker::class);
        return new AsyncEventDispatcher($listeners, $stdoutLogger, $asyncEventService, $locker);
    }
}
