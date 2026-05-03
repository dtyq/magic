<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Transport;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Transport\ApiKeyDashScopeTransport;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;

/**
 * @internal
 */
class ApiKeyDashScopeTransportTest extends TestCase
{
    public function testSubmitVideoBuildsDashScopeSynthesisPath(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://localhost/api/v1/services/aigc/video-generation/video-synthesis',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                        'X-DashScope-Async' => 'enable',
                    ],
                    'json' => ['prompt' => 'test'],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'output' => ['task_id' => 'task-1'],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(DashScopeVideoClient::class)
            ->willReturn(new DashScopeRecordingLogger());

        $transport = new ApiKeyDashScopeTransport(new DashScopeVideoClient($clientFactory, $loggerFactory));
        $transport->submitVideo(
            new QueueExecutorConfig(
                'https://localhost',
                'secret',
                3,
                20,
                []
            ),
            ['prompt' => 'test'],
            ['video_id' => 'video-1']
        );
    }

    public function testQueryTaskBuildsDashScopeTaskPath(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://localhost/api/v1/tasks/task-123',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'output' => ['task_status' => 'RUNNING'],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(DashScopeVideoClient::class)
            ->willReturn(new DashScopeRecordingLogger());

        $transport = new ApiKeyDashScopeTransport(new DashScopeVideoClient($clientFactory, $loggerFactory));
        $transport->queryTask(
            new QueueExecutorConfig(
                'https://localhost',
                'secret',
                3,
                20,
                []
            ),
            'task-123',
            ['video_id' => 'video-1']
        );
    }
}

final class DashScopeRecordingLogger extends AbstractLogger
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
