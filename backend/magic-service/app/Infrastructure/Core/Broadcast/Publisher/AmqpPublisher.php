<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Broadcast\Publisher;

use App\Infrastructure\Core\Broadcast\KeepAlive;
use Hyperf\Amqp\ConnectionFactory;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;

class AmqpPublisher implements PublisherInterface
{
    public function __construct(
        protected ConnectionFactory $connectionFactory,
        protected LoggerInterface $logger,
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
