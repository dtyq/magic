<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Publish;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicMessageProcessEvent;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

/**
 * 话题消息处理发布器（轻量级）.
 * 只通知消费者有消息需要处理，不传递具体消息内容.
 */
#[Producer(exchange: 'super_magic_topic_message_process', routingKey: 'super_magic_topic_message_process')]
class TopicMessageProcessPublisher extends ProducerMessage
{
    /**
     * 构造函数.
     */
    public function __construct(TopicMessageProcessEvent $event)
    {
        $this->payload = $event->toArray();

        // 设置 AMQP 消息属性
        $this->properties = [
            'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT, // 保持消息持久化
            'application_headers' => new AMQPTable([
                'x-original-timestamp' => time(), // 设置原始时间戳（秒级）
                'x-event-type' => 'topic_message_process', // 事件类型
            ]),
        ];
    }
}
