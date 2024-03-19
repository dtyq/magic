<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent;

use Hyperf\Context\ApplicationContext;
use Psr\EventDispatcher\EventDispatcherInterface;

class AsyncEventUtil
{
    public static function dispatch(object $event): void
    {
        $dispatcher = ApplicationContext::getContainer()->get(EventDispatcherInterface::class);
        $dispatcher->dispatch($event);
    }
}
