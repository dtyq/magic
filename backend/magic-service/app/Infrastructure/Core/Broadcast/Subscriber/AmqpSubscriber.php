<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Broadcast\Subscriber;

use App\Infrastructure\Core\Broadcast\KeepAlive;
use Closure;
use Hyperf\Amqp\ConnectionFactory;
use Hyperf\Coordinator\Timer;
use Hyperf\Coroutine\Coroutine;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;

class AmqpSubscriber implements SubscriberInterface
{
    public function __construct(
        protected ConnectionFactory $connectionFactory,
        protected LoggerInterface $logger,
        protected Timer $timer,
    ) {
    }

    public function subscribe(string $channel, Closure $closure, bool $async = true): void
    {
        $connect = $this->connectionFactory->getConnection('default');
        $amqpChannel = $connect->getChannel();

        $amqpChannel->exchange_declare($channel, 'fanout', false, false, false);
        [$queueName] = $amqpChannel->queue_declare('', false, false, true, false);
        $amqpChannel->queue_bind($queueName, $channel);

        $callback = function (AMQPMessage $AMQPMessage) use ($channel, $closure, $async) {
            $msg = $AMQPMessage->getBody();
            if (KeepAlive::isPing($msg)) {
                return;
            }
            $this->logger->info('[AmqpSubscriber] ' . $channel . ' ' . $msg);
            $function = function () use ($closure, $msg) {
                $closure($msg);
            };
            if ($async) {
                Coroutine::create($function);
            } else {
                $function();
            }
        };

        $amqpChannel->basic_consume($queueName, '', false, true, false, false, $callback);

        KeepAlive::create($channel);

        while ($amqpChannel->is_consuming()) {
            $amqpChannel->wait();
        }
    }
}
