<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Demo\Subscribe;

use Dtyq\AsyncEvent\Demo\DemoEvent;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

#[AsyncListener(driver: 'coroutine', waitForSync: false)]
#[Listener]
class DemoAsyncFastSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(ContainerInterface $container)
    {
        $this->logger = $container->get(LoggerInterface::class);
    }

    public function listen(): array
    {
        return [
            DemoEvent::class,
        ];
    }

    public function process(object $event): void
    {
        // Simulate processing time
        echo 'DemoAsyncFastSubscriber processed event with data: ' . $event->getMessage() . PHP_EOL;
        $this->logger->info('DemoAsyncFastSubscriber processed event with data: ' . $event->getMessage());
    }
}
