<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Driver\Queue;

use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

#[Producer(exchange: 'async_event_listener', routingKey: 'async_event_listener')]
class ListenerProducerMessage extends ProducerMessage
{
    public function __construct(int $id, array $contextData = [])
    {
        $this->payload = [
            'id' => $id,
            'context_data' => $contextData,
        ];
    }
}
