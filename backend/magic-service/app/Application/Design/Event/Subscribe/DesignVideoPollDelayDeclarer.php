<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Event\Subscribe;

use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Builder\QueueBuilder;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

#[Consumer(
    exchange: 'design.video.poll.delay',
    routingKey: 'design.video.poll',
    queue: 'design.video.poll.delay.10s',
    nums: 0
)]
class DesignVideoPollDelayDeclarer extends ConsumerMessage
{
    protected string $exchange = 'design.video.poll.delay';

    protected ?string $queue = 'design.video.poll.delay.10s';

    protected array|string $routingKey = 'design.video.poll';

    public function getQueueBuilder(): QueueBuilder
    {
        return parent::getQueueBuilder()->setArguments(new AMQPTable([
            'x-ha-policy' => ['S', 'all'],
            'x-message-ttl' => (int) config('design_generation.video_poll.delay_ms', 10000),
            'x-dead-letter-exchange' => 'design.video.poll',
            'x-dead-letter-routing-key' => 'design.video.poll',
        ]));
    }

    public function consumeMessage($data, AMQPMessage $message): Result
    {
        return Result::ACK;
    }
}
