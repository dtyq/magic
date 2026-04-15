<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;

/**
 * @internal
 */
class VolcengineArkVideoClientTest extends TestCase
{
    public function testPostLogsStructuredErrorContextOnHttpFailure(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'bad request',
                new Request('POST', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'),
                new Response(400, ['x-tt-logid' => ['req-ark-400']], json_encode([
                    'error' => [
                        'message' => 'service_tier must be empty',
                    ],
                ], JSON_THROW_ON_ERROR)),
            ));

        $logger = new VolcengineArkRecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(VolcengineArkVideoClient::class)
            ->willReturn($logger);

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $client = new VolcengineArkVideoClient($clientFactory, $loggerFactory);

        $this->expectException(ProviderVideoException::class);
        $this->expectExceptionMessage('service_tier must be empty');
        try {
            $client->post(
                'https://ark.cn-beijing.volces.com/api/v3',
                'secret-api-key',
                '/contents/generations/tasks',
                ['model' => 'doubao-seedance-2-0-260128'],
                ['operation_id' => 'op-ark-400'],
            );
        } finally {
            $this->assertCount(2, $logger->records);
            $this->assertSame('volcengine ark video error', $logger->records[1]['message']);
            $this->assertSame('post', $logger->records[1]['context']['method']);
            $this->assertSame('/contents/generations/tasks', $logger->records[1]['context']['path']);
            $this->assertSame('op-ark-400', $logger->records[1]['context']['context']['operation_id']);
            $this->assertSame(400, $logger->records[1]['context']['http_status']);
            $this->assertSame('req-ark-400', $logger->records[1]['context']['provider_request_id']);
            $this->assertSame('service_tier must be empty', $logger->records[1]['context']['error']);
        }
    }

    public function testGetResponseLogIncludesHttpStatusAndElapsedTime(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->willReturn(new Response(200, ['x-tt-logid' => ['req-ark-200']], json_encode([
                'id' => 'task-1',
                'status' => 'running',
            ], JSON_THROW_ON_ERROR)));

        $logger = new VolcengineArkRecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(VolcengineArkVideoClient::class)
            ->willReturn($logger);

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $client = new VolcengineArkVideoClient($clientFactory, $loggerFactory);
        $response = $client->get(
            'https://ark.cn-beijing.volces.com/api/v3',
            'secret-api-key',
            '/contents/generations/tasks/task-1',
            ['operation_id' => 'op-ark-200', 'provider_task_id' => 'task-1'],
        );

        $this->assertSame('running', $response['status']);
        $this->assertCount(2, $logger->records);
        $this->assertSame('volcengine ark video request', $logger->records[0]['message']);
        $this->assertSame('volcengine ark video response', $logger->records[1]['message']);
        $this->assertSame(200, $logger->records[1]['context']['http_status']);
        $this->assertSame('req-ark-200', $logger->records[1]['context']['provider_request_id']);
        $this->assertIsInt($logger->records[1]['context']['elapsed_ms']);
        $this->assertGreaterThanOrEqual(0, $logger->records[1]['context']['elapsed_ms']);
    }
}

final class VolcengineArkRecordingLogger extends AbstractLogger
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
