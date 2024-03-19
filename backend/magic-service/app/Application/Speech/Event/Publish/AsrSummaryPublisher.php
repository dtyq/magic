<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Event\Publish;

use App\Application\Speech\Event\AsrSummaryMessage;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

#[Producer(exchange: 'asr.summary', routingKey: 'asr.summary')]
class AsrSummaryPublisher extends ProducerMessage
{
    public function __construct(AsrSummaryMessage $message)
    {
        $this->payload = $message->toArray();
    }
}
