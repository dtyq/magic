<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
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
class CloudswayVideoClientTest extends TestCase
{
    public function testGetResponseLogIncludesStructuredContextAndResponse(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->willReturn(new Response(200, [], json_encode([
                'code' => 0,
                'message' => 'SUCCEED',
                'data' => [
                    'task_id' => '866464916562530396',
                    'task_status' => 'processing',
                ],
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)));

        $logger = new CloudswayRecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(CloudswayVideoClient::class)
            ->willReturn($logger);

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $client = new CloudswayVideoClient($clientFactory, $loggerFactory);
        $response = $client->get(
            'https://genaiapi.cloudsway.net',
            'secret-api-key',
            '/v1/ai/YGNqszpCuuWLpyUt/kling/videos/text2video/866464916562530396',
            ['video_id' => 'video-123', 'operation_id' => 'op-123'],
        );

        $this->assertSame('processing', $response['data']['task_status']);
        $this->assertCount(2, $logger->records);
        $this->assertSame('cloudsway video get request', $logger->records[0]['message']);
        $this->assertSame('cloudsway video get response', $logger->records[1]['message']);
        $this->assertSame('https://genaiapi.cloudsway.net', $logger->records[1]['context']['base_url']);
        $this->assertSame('/v1/ai/YGNqszpCuuWLpyUt/kling/videos/text2video/866464916562530396', $logger->records[1]['context']['path']);
        $this->assertSame('video-123', $logger->records[1]['context']['context']['video_id']);
        $this->assertSame('op-123', $logger->records[1]['context']['context']['operation_id']);
        $this->assertSame(0, $logger->records[1]['context']['response']['code']);
        $this->assertSame('processing', $logger->records[1]['context']['response']['data']['task_status']);
        $this->assertStringNotContainsString('secret-api-key', json_encode($logger->records, JSON_THROW_ON_ERROR));
    }

    public function testPostThrowsProviderVideoExceptionWithStructuredProviderMessageOnHttpError(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'bad request',
                new Request('POST', 'https://genaiapi.cloudsway.net/v1/ai/endpoint/veo/videos/generate'),
                new Response(400, [], json_encode([
                    'error' => [
                        'code' => 'INVALID_ARGUMENT',
                        'message' => 'durationSeconds must be one of [4,6,8]',
                    ],
                ], JSON_THROW_ON_ERROR)),
            ));

        $logger = new CloudswayRecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(CloudswayVideoClient::class)
            ->willReturn($logger);

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $client = new CloudswayVideoClient($clientFactory, $loggerFactory);

        $this->expectException(ProviderVideoException::class);
        $this->expectExceptionMessage('durationSeconds must be one of [4,6,8]');
        try {
            $client->post(
                'https://genaiapi.cloudsway.net',
                'secret-api-key',
                '/v1/ai/endpoint/veo/videos/generate',
                ['prompt' => 'test'],
                ['video_id' => 'video-err-1', 'operation_id' => 'op-err-1'],
            );
        } finally {
            $this->assertCount(2, $logger->records);
            $this->assertSame('cloudsway video post error', $logger->records[1]['message']);
            $this->assertSame('video-err-1', $logger->records[1]['context']['context']['video_id']);
            $this->assertSame('op-err-1', $logger->records[1]['context']['context']['operation_id']);
            $this->assertSame('durationSeconds must be one of [4,6,8]', $logger->records[1]['context']['error']);
        }
    }
}

final class CloudswayRecordingLogger extends AbstractLogger
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
