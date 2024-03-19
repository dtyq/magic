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

#[AsyncListener]
#[Listener]
class DemoAsyncSubscriber implements ListenerInterface
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
        sleep(2);
        echo 'DemoAsyncSubscriber processed event with data: ' . $event->getMessage() . PHP_EOL;
        $this->logger->info('DemoAsyncSubscriber processed event with data: ' . $event->getMessage());
    }
}
