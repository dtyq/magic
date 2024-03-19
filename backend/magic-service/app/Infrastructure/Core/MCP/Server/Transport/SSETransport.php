<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Transport;

use App\Infrastructure\Core\Broadcast\Publisher\PublisherInterface;
use App\Infrastructure\Core\MCP\Server\Handler\MCPHandler;
use App\Infrastructure\Core\MCP\Server\Transport\SSE\BroadcastPayload;
use App\Infrastructure\Core\MCP\Server\Transport\SSE\ConnectionManager;
use App\Infrastructure\Core\MCP\Server\Transport\SSE\SSEStream;
use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;
use App\Infrastructure\Core\MCP\Types\Message\Notification;
use App\Infrastructure\Core\MCP\Types\Message\Request;
use Hyperf\Codec\Packer\JsonPacker;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\HttpMessage\Server\Response;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class SSETransport implements TransportInterface
{
    public const string BroadcastChannel = 'MCPSSETransportBroadcastChannel';

    private LoggerInterface $logger;

    private ConnectionManager $connectionManager;

    public function __construct(
        protected RequestInterface $request,
        protected ResponseInterface $response,
        protected LoggerFactory $loggerFactory,
        protected JsonPacker $packer,
        protected PhpSerializerPacker $broadcastPacker,
        protected PublisherInterface $publisher,
    ) {
        $this->logger = $this->loggerFactory->get('SSETransport');
        $this->connectionManager = ApplicationContext::getContainer()->get(ConnectionManager::class);
    }

    public function register(string $path, string $serverName, MCPHandler $handler): void
    {
        $sessionId = uniqid('magic_sse_');
        /** @var Response $response */
        $response = ApplicationContext::getContainer()->get(ResponseInterface::class);
        $eventStream = new SSEStream($response);
        $this->connectionManager->registerConnection($serverName, $sessionId, $eventStream, $handler);
        $response->setConnection($eventStream);

        $eventStream->write('event:endpoint');
        $eventStream->write("data:{$path}?sessionId={$sessionId}" . PHP_EOL);
    }

    public function handle(string $serverName, string $sessionId, MessageInterface $message, bool $broadcast = true): void
    {
        if (! $sessionId) {
            return;
        }
        if ($broadcast) {
            $this->publisher->publish(self::BroadcastChannel, $this->broadcastPacker->pack(new BroadcastPayload($serverName, $sessionId, $message)));
            return;
        }
        if (! $this->connectionManager->exist($serverName, $sessionId)) {
            return;
        }

        $handler = $this->connectionManager->getHandler($serverName, $sessionId);

        $response = $handler->handle($message);
        if (is_null($response)) {
            return;
        }
        $responseMessage = $this->packer->pack($response);

        $connection = $this->connectionManager->getConnection($serverName, $sessionId);

        if ($connection !== null) {
            $connection->write("event:message\ndata: {$responseMessage}\n\n");
            $this->logger->info('SSETransportHandle', [
                'server_name' => $serverName,
                'session_id' => $sessionId,
                'message' => $message,
                'response' => $responseMessage,
            ]);
        } else {
            $this->logger->warning('CannotSendMessage: connection not found', [
                'server_name' => $serverName,
                'session_id' => $sessionId,
            ]);
        }
    }

    public function readMessage(): MessageInterface
    {
        $message = $this->packer->unpack($this->request->getBody()->getContents());
        if (! isset($message['id'])) {
            return new Notification(...$message);
        }
        return new Request(...$message);
    }
}
