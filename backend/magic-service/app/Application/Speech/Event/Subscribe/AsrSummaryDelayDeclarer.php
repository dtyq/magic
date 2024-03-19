<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Event\Subscribe;

use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Builder\QueueBuilder;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

/**
 * ASR 总结延迟队列声明者.
 *
 * 注意：此类仅用于利用 Hyperf 的自动声明机制来创建和配置 RabbitMQ 队列。
 * 通过设置 nums: 0，确保不会启动任何消费进程。
 *
 * 工作流程：
 * 1. 业务处理失败 -> 发布消息到此交换机 (asr.summary.delay)
 * 2. 消息在此队列 (asr.summary.delay.10s) 中堆积，无人消费
 * 3. 10秒后 (x-message-ttl)，消息过期成为死信
 * 4. RabbitMQ 自动将死信重新投递到 x-dead-letter-exchange 指定的交换机
 * 5. 最终回到主业务队列实现延迟重试
 */
#[Consumer(
    exchange: 'asr.summary.delay',
    routingKey: 'asr.summary',
    queue: 'asr.summary.delay.10s',
    nums: 0 // 关键：设置为 0 表示只声明队列和绑定关系，不启动消费进程
)]
class AsrSummaryDelayDeclarer extends ConsumerMessage
{
    protected string $exchange = 'asr.summary.delay';

    protected ?string $queue = 'asr.summary.delay.10s';

    protected array|string $routingKey = 'asr.summary';

    public function getQueueBuilder(): QueueBuilder
    {
        return parent::getQueueBuilder()->setArguments(new AMQPTable([
            'x-ha-policy' => ['S', 'all'], // 保留原有默认参数
            'x-message-ttl' => 10000,
            'x-dead-letter-exchange' => 'asr.summary',
            'x-dead-letter-routing-key' => 'asr.summary',
        ]));
    }

    /**
     * 因为 nums 为 0，此方法永远不会被执行.
     * @param mixed $data
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        return Result::ACK;
    }
}
