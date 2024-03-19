<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Broadcast\Publisher;

use App\Infrastructure\Core\Broadcast\KeepAlive;
use App\Infrastructure\Core\Traits\HasLogger;
use Hyperf\Amqp\ConnectionFactory;
use PhpAmqpLib\Message\AMQPMessage;

class AmqpPublisher implements PublisherInterface
{
    use HasLogger;

    public function __construct(
        protected ConnectionFactory $connectionFactory,
    ) {
    }

    public function publish(string $channel, string $message): void
    {
        $connect = $this->connectionFactory->getConnection('default');
        $amqpChannel = $connect->getChannel();
        try {
            $amqpChannel->exchange_declare($channel, 'fanout', false, false, false);
            $amqpMessage = new AMQPMessage($message);
            $amqpChannel->basic_publish($amqpMessage, $channel);
        } finally {
            $connect->releaseChannel($amqpChannel);
        }

        if (KeepAlive::isPing($message)) {
            return;
        }
        $this->logger->info('[AmqpPublisher] ' . $channel . ' ' . $message);
    }
}
