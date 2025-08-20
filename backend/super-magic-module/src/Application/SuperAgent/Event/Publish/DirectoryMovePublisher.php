<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Publish;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\DirectoryMoveEvent;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

/**
 * File batch move message publisher.
 */
#[Producer(exchange: 'file.directory.move', routingKey: 'file.directory.move')]
class DirectoryMovePublisher extends ProducerMessage
{
    public function __construct(DirectoryMoveEvent $event)
    {
        $this->payload = $event->toArray();
    }
}
