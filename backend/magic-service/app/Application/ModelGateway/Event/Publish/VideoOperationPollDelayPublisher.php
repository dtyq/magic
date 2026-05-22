<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Publish;

use App\Application\ModelGateway\Event\Message\VideoOperationPollMessage;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

#[Producer(exchange: 'model_gateway.videos.poll.delay', routingKey: 'model_gateway.videos.poll')]
class VideoOperationPollDelayPublisher extends ProducerMessage
{
    public function __construct(VideoOperationPollMessage $message)
    {
        $this->payload = $message->toArray();
    }
}
