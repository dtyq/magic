<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Event\Listener;

use App\Application\Design\Event\Subscribe\DesignVideoPollDelayDeclarer;
use Hyperf\Amqp\Consumer;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Server\Event\MainCoroutineServerStart;
use Psr\Container\ContainerInterface;

#[Listener]
class DesignVideoPollDelayQueueDeclareListener implements ListenerInterface
{
    public function __construct(
        private readonly ContainerInterface $container,
    ) {
    }

    public function listen(): array
    {
        return [MainCoroutineServerStart::class];
    }

    public function process(object $event): void
    {
        $this->container->get(Consumer::class)->declare(new DesignVideoPollDelayDeclarer());
    }
}
