<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Subscribe;

use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Builder\QueueBuilder;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

#[Consumer(
    exchange: 'model_gateway.videos.poll.delay',
    routingKey: 'model_gateway.videos.poll',
    queue: 'model_gateway.videos.poll.delay.10s',
    nums: 0
)]
class VideoOperationPollDelayDeclarer extends ConsumerMessage
{
    protected string $exchange = 'model_gateway.videos.poll.delay';

    protected ?string $queue = 'model_gateway.videos.poll.delay.10s';

    protected array|string $routingKey = 'model_gateway.videos.poll';

    public function getQueueBuilder(): QueueBuilder
    {
        return parent::getQueueBuilder()->setArguments(new AMQPTable([
            'x-ha-policy' => ['S', 'all'],
            'x-message-ttl' => 10000,
            'x-dead-letter-exchange' => 'model_gateway.videos.poll',
            'x-dead-letter-routing-key' => 'model_gateway.videos.poll',
        ]));
    }

    public function consumeMessage($data, AMQPMessage $message): Result
    {
        return Result::ACK;
    }
}
