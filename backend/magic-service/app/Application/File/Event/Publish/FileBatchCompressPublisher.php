<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Event\Publish;

use App\Domain\File\Event\FileBatchCompressEvent;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

/**
 * File batch compression message publisher.
 */
#[Producer(exchange: 'file.batch.compress', routingKey: 'file.batch.compress')]
class FileBatchCompressPublisher extends ProducerMessage
{
    public function __construct(FileBatchCompressEvent $event)
    {
        $this->payload = [
            'source' => $event->getSource(),
            'organization_code' => $event->getOrganizationCode(),
            'user_id' => $event->getUserId(),
            'cache_key' => $event->getCacheKey(),
            'files' => $event->getFiles(),
            'workdir' => $event->getWorkdir(),
            'target_name' => $event->getTargetName(),
            'target_path' => $event->getTargetPath(),
            'bucket_type' => $event->getBucketType(),
        ];
    }
}
