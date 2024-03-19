<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Listener;

use App\Application\Speech\Event\Subscribe\AsrSummaryDelayDeclarer;
use Hyperf\Amqp\Consumer;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Server\Event\MainCoroutineServerStart;
use PhpAmqpLib\Exception\AMQPProtocolChannelException;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;

#[Listener]
class AmqpDeclareDelayQueueListener implements ListenerInterface
{
    public function __construct(protected ContainerInterface $container)
    {
    }

    public function listen(): array
    {
        return [
            MainCoroutineServerStart::class,
        ];
    }

    /**
     * @throws AMQPProtocolChannelException
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     */
    public function process(object $event): void
    {
        /** @var Consumer $consumer */
        $consumer = $this->container->get(Consumer::class);
        // 为了实现死信队列，手动实例化并声明延迟队列
        // 因为消费者的 nums: 0 不会被自动拉起，所以需要手动 declare
        $message = new AsrSummaryDelayDeclarer();
        $consumer->declare($message);
    }
}
