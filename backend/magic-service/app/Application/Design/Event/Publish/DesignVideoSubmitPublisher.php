<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Event\Publish;

use App\Application\Design\Event\Message\DesignVideoSubmitMessage;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;

/**
 * 投递 Design 视频异步提交消息。
 */
#[Producer(exchange: 'design.videos.submit', routingKey: 'design.videos.submit')]
class DesignVideoSubmitPublisher extends ProducerMessage
{
    /**
     * 初始化消息载荷。
     */
    public function __construct(DesignVideoSubmitMessage $message)
    {
        $this->payload = $message->toArray();
    }
}
