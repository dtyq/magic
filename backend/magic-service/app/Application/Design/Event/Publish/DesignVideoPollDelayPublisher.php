<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Event\Publish;

use App\Application\Design\Event\Message\DesignVideoPollMessage;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

#[Producer(exchange: 'design.videos.poll.delay', routingKey: 'design.videos.poll')]
class DesignVideoPollDelayPublisher extends ProducerMessage
{
    public function __construct(DesignVideoPollMessage $message)
    {
        $this->payload = $message->toArray();
    }
}
