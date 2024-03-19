<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Publish;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\TaskInitializationEvent;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

/**
 * Task initialization publisher.
 */
#[Producer]
class TaskInitializationPublisher extends ProducerMessage
{
    public function __construct(
        private readonly TaskInitializationEvent $event
    ) {
        $this->exchange = 'super-magic';
        $this->routingKey = 'task.initialization';
    }

    public function payload(): string
    {
        return json_encode($this->event->message->toArray(), JSON_UNESCAPED_UNICODE);
    }
}
