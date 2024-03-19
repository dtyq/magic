<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Publish;

use App\Domain\Chat\Entity\ValueObject\AmqpTopicType;
use App\Domain\Chat\Event\Seq\SeqCreatedEvent;
use App\Infrastructure\Core\Traits\ChatAmqpTrait;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

/**
 * 消息分发模块,可能需要根据一个seq,生成一个或者多个seq.
 */
#[Producer]
class MessageDispatchPublisher extends ProducerMessage
{
    use ChatAmqpTrait;

    protected AmqpTopicType $topic = AmqpTopicType::Message;

    public function __construct(SeqCreatedEvent $event)
    {
        $this->exchange = $this->getExchangeName($this->topic);
        $this->routingKey = $this->getRoutingKeyName($this->topic, $event->getPriority());
        $this->payload = $event->toArray();
    }
}
