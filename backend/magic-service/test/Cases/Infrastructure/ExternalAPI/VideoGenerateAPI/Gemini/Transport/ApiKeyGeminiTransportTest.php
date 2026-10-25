<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Transport;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\GeminiVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Transport\ApiKeyGeminiTransport;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * @internal
 */
final class ApiKeyGeminiTransportTest extends TestCase
{
    public function testCreateInteractionUsesInteractionsPath(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())->method('post')->with(
            'https://gemini.example/v1/interactions',
            [
                'headers' => ['x-goog-api-key' => 'secret', 'Content-Type' => 'application/json'],
                'json' => ['model' => 'gemini-omni-1.1-flash'],
            ],
        )->willReturn(new Response(200, [], '{"id":"interaction-1"}'));
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new TransportRecordingLogger());
        $client = new GeminiVideoClient($clientFactory, $loggerFactory);

        $result = (new ApiKeyGeminiTransport($client))->createInteraction(
            new QueueExecutorConfig('https://gemini.example/v1/interactions', 'secret', 3, 20),
            ['model' => 'gemini-omni-1.1-flash'],
            ['operation_id' => 'op-1'],
        );

        self::assertSame(['id' => 'interaction-1'], $result);
    }

    public function testCreateInteractionUsesProxyFromQueueConfig(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())->method('post')->with(
            'https://gemini.example/v1/interactions',
            [
                'headers' => ['x-goog-api-key' => 'secret', 'Content-Type' => 'application/json'],
                'json' => ['model' => 'gemini-omni-1.1-flash'],
            ],
        )->willReturn(new Response(200, [], '{"id":"interaction-1"}'));
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())->method('create')->with([
            'timeout' => 30,
            'verify' => true,
            'proxy' => 'socks5h://127.0.0.1:1080',
        ])->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new TransportRecordingLogger());

        $result = (new ApiKeyGeminiTransport(new GeminiVideoClient($clientFactory, $loggerFactory)))->createInteraction(
            new QueueExecutorConfig(
                'https://gemini.example/v1/interactions',
                'secret',
                3,
                20,
                ['proxy_url' => 'socks5h://127.0.0.1:1080'],
            ),
            ['model' => 'gemini-omni-1.1-flash'],
        );

        self::assertSame(['id' => 'interaction-1'], $result);
    }

    public function testGetInteractionEncodesIdAndUsesInteractionsPath(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())->method('get')->with(
            'https://gemini.example/v1/interactions/interaction%2F1',
            [
                'headers' => ['x-goog-api-key' => 'secret', 'Content-Type' => 'application/json'],
            ],
        )->willReturn(new Response(200, [], '{"id":"interaction/1","status":"completed"}'));
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new TransportRecordingLogger());
        $client = new GeminiVideoClient($clientFactory, $loggerFactory);

        $result = (new ApiKeyGeminiTransport($client))->getInteraction(
            new QueueExecutorConfig('https://gemini.example/v1/interactions', 'secret', 3, 20),
            'interaction/1',
            ['provider_task_id' => 'interaction/1'],
        );

        self::assertSame('completed', $result['status']);
    }

    public function testDownloadMediaUsesGeminiApiKeyAndReturnsBytesContract(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())->method('get')->with(
            'https://example.com/video.mp4',
            $this->callback(function (array $options): bool {
                self::assertSame('secret', $options['headers']['x-goog-api-key'] ?? null);
                self::assertSame('*/*', $options['headers']['Accept'] ?? null);
                self::assertFalse($options['allow_redirects']);
                return true;
            }),
        )->willReturn(new Response(200, ['Content-Type' => 'video/mp4'], 'video-bytes'));
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new TransportRecordingLogger());
        $client = new GeminiVideoClient($clientFactory, $loggerFactory);

        $result = (new ApiKeyGeminiTransport($client))->downloadMedia(
            new QueueExecutorConfig('https://example.com/v1/interactions', 'secret', 3, 20),
            'https://example.com/video.mp4',
        );

        self::assertSame(base64_encode('video-bytes'), $result['bytes_base64_encoded']);
        self::assertSame('video/mp4', $result['mime_type']);
    }
}

final class TransportRecordingLogger extends NullLogger
{
}
