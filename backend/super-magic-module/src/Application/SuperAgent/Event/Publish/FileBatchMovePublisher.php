<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Publish;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchMoveEvent;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

/**
 * File batch move message publisher.
 */
#[Producer(exchange: 'super_magic_file_batch_move', routingKey: 'super_magic_file_batch_move')]
class FileBatchMovePublisher extends ProducerMessage
{
    public function __construct(FileBatchMoveEvent $event)
    {
        $this->payload = $event->toArray();
    }
}
