<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Listener;

use App\Application\ModelGateway\Event\Subscribe\VideoOperationPollDelayDeclarer;
use Hyperf\Amqp\Consumer;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Server\Event\MainCoroutineServerStart;
use Psr\Container\ContainerInterface;

#[Listener]
class VideoOperationPollDelayQueueDeclareListener implements ListenerInterface
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
        $this->container->get(Consumer::class)->declare(new VideoOperationPollDelayDeclarer());
    }
}
