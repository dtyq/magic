<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Publish;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchCopyEvent;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

/**
 * File batch copy message publisher.
 */
#[Producer(exchange: 'super_magic_file_batch_copy', routingKey: 'super_magic_file_batch_copy')]
class FileBatchCopyPublisher extends ProducerMessage
{
    public function __construct(FileBatchCopyEvent $event)
    {
        $this->payload = $event->toArray();
    }
}
