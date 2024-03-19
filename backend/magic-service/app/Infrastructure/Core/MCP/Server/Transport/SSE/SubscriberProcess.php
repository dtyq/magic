<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Transport\SSE;

use App\Infrastructure\Core\Broadcast\Subscriber\SubscriberInterface;
use App\Infrastructure\Core\MCP\Server\Transport\SSETransport;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Process\AbstractProcess;
use Hyperf\Process\Annotation\Process;
use Psr\Container\ContainerInterface;

// #[Process(name: 'mcp_sse_broadcast_subscriber')]
class SubscriberProcess extends AbstractProcess
{
    protected SubscriberInterface $subscriber;

    protected SSETransport $SSETransport;

    protected PhpSerializerPacker $broadcastPacker;

    public function __construct(ContainerInterface $container)
    {
        parent::__construct($container);
        $this->subscriber = $container->get(SubscriberInterface::class);
        $this->SSETransport = $container->get(SSETransport::class);
        $this->broadcastPacker = $container->get(PhpSerializerPacker::class);
    }

    public function handle(): void
    {
        $this->subscriber->subscribe(SSETransport::BroadcastChannel, function (string $message) {
            $broadcastPayload = $this->broadcastPacker->unpack($message);
            if (! $broadcastPayload instanceof BroadcastPayload) {
                return;
            }
            $this->SSETransport->handle($broadcastPayload->getServerName(), $broadcastPayload->getSessionId(), $broadcastPayload->getMessage(), false);
        });
    }
}
