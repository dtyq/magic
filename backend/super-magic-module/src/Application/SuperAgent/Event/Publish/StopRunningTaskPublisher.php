<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Publish;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\StopRunningTaskEvent;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

/**
 * 停止运行中任务消息发布器.
 */
#[Producer(exchange: 'super_magic_stop_task', routingKey: 'super_magic_stop_task')]
class StopRunningTaskPublisher extends ProducerMessage
{
    /**
     * 构造函数.
     */
    public function __construct(StopRunningTaskEvent $event)
    {
        $this->payload = $event->toArray();

        // 设置 AMQP 消息属性，包括原始时间戳
        $this->properties = [
            'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT, // 保持消息持久化
            'application_headers' => new AMQPTable([
                'x-original-timestamp' => time(), // 设置原始时间戳（秒级）
                'x-data-type' => $event->getDataType()->value, // 设置数据类型方便路由和监控
                'x-organization-code' => $event->getOrganizationCode(), // 设置组织编码
            ]),
        ];
    }
}
