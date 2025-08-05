<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Publish;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicTaskMessageEvent;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

/**
 * 话题任务消息发布器.
 */
#[Producer(exchange: 'super_magic_topic_task_message', routingKey: 'super_magic_topic_task_message')]
class TopicTaskMessagePublisher extends ProducerMessage
{
    /**
     * 构造函数.
     */
    public function __construct(TopicTaskMessageEvent $event)
    {
        $this->payload = $event->toArray();

        // 设置 AMQP 消息属性，包括原始时间戳
        $this->properties = [
            'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT, // 保持消息持久化
            'application_headers' => new AMQPTable([
                'x-original-timestamp' => time(), // 设置原始时间戳（秒级）
            ]),
        ];
    }
}
