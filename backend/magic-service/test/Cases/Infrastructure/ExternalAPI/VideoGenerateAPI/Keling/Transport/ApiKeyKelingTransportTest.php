<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport\ApiKeyKelingTransport;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;

/**
 * @internal
 */
class ApiKeyKelingTransportTest extends TestCase
{
    public function testSubmitOmniVideoBuildsCloudswayOmniPath(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://localhost/v1/ai/workspace-demo/kling/videos/omni-video',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                    'json' => ['prompt' => 'test'],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'code' => 0,
                'data' => ['task_id' => 'task-1'],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(KelingVideoClient::class)
            ->willReturn(new KelingRecordingLogger());

        $transport = new ApiKeyKelingTransport(new KelingVideoClient($clientFactory, $loggerFactory));
        $transport->submitOmniVideo(
            new QueueExecutorConfig(
                'https://localhost/v1/ai/workspace-demo',
                'secret',
                3,
                20,
                []
            ),
            ['prompt' => 'test'],
            ['video_id' => 'video-1']
        );
    }

    public function testQueryOmniVideoBuildsCloudswayOmniPath(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://localhost/v1/ai/workspace-demo/kling/videos/omni-video/task-123',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'code' => 0,
                'data' => ['task_status' => 'processing'],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(KelingVideoClient::class)
            ->willReturn(new KelingRecordingLogger());

        $transport = new ApiKeyKelingTransport(new KelingVideoClient($clientFactory, $loggerFactory));
        $transport->queryOmniVideo(
            new QueueExecutorConfig(
                'https://localhost/v1/ai/workspace-demo',
                'secret',
                3,
                20,
                []
            ),
            'task-123',
            ['video_id' => 'video-1']
        );
    }

    public function testSubmitV3VideoBuildsTextToVideoPath(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://localhost/v1/ai/workspace-demo/kling/videos/text2video',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                    'json' => ['prompt' => 'test'],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'code' => 0,
                'data' => ['task_id' => 'task-v3'],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(KelingVideoClient::class)
            ->willReturn(new KelingRecordingLogger());

        $transport = new ApiKeyKelingTransport(new KelingVideoClient($clientFactory, $loggerFactory));
        $transport->submitV3Video(
            new QueueExecutorConfig(
                'https://localhost/v1/ai/workspace-demo',
                'secret',
                3,
                20,
                []
            ),
            ['prompt' => 'test'],
            false,
            ['video_id' => 'video-2']
        );
    }

    public function testQueryV3VideoBuildsImageToVideoPath(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://localhost/v1/ai/workspace-demo/kling/videos/image2video/task-v3',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'code' => 0,
                'data' => ['task_status' => 'processing'],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(KelingVideoClient::class)
            ->willReturn(new KelingRecordingLogger());

        $transport = new ApiKeyKelingTransport(new KelingVideoClient($clientFactory, $loggerFactory));
        $transport->queryV3Video(
            new QueueExecutorConfig(
                'https://localhost/v1/ai/workspace-demo',
                'secret',
                3,
                20,
                []
            ),
            'task-v3',
            true,
            ['video_id' => 'video-2']
        );
    }
}

final class KelingRecordingLogger extends AbstractLogger
{
    /** @var array<int, array{level: string, message: string, context: array<mixed>}> */
    public array $records = [];

    public function log($level, $message, array $context = []): void
    {
        $this->records[] = [
            'level' => (string) $level,
            'message' => (string) $message,
            'context' => $context,
        ];
    }
}
