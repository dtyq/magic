<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVideoClient;
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
class WuyinVideoClientTest extends TestCase
{
    public function testSubmitLogsRequestAndResponseWithoutApiKey(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willReturn(new Response(200, [], json_encode([
                'code' => 200,
                'msg' => '成功',
                'data' => [
                    'id' => 'video_task_123',
                ],
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)));

        $logger = new RecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(WuyinVideoClient::class)
            ->willReturn($logger);

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $client = new WuyinVideoClient($clientFactory, $loggerFactory);
        $client->submit('https://api.wuyinkeji.com', 'secret-api-key', 'veo3.1_fast', [
            'prompt' => 'make a video',
        ]);

        $this->assertCount(2, $logger->records);
        $this->assertSame('wuyin video submit request', $logger->records[0]['message']);
        $this->assertSame('wuyin video submit response', $logger->records[1]['message']);
        $this->assertSame('/api/async/video_veo3.1_fast', $logger->records[0]['context']['endpoint']);
        $this->assertSame('video_task_123', $logger->records[1]['context']['task_id']);
        $this->assertStringNotContainsString('secret-api-key', json_encode($logger->records, JSON_THROW_ON_ERROR));
    }

    public function testQueryLogsRequestAndResponseWithoutApiKey(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->willReturn(new Response(200, [], json_encode([
                'code' => 200,
                'msg' => '成功',
                'data' => [
                    'status' => 2,
                    'result' => [
                        'url' => 'https://example.com/video.mp4',
                    ],
                ],
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)));

        $logger = new RecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(WuyinVideoClient::class)
            ->willReturn($logger);

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $client = new WuyinVideoClient($clientFactory, $loggerFactory);
        $client->query('https://api.wuyinkeji.com', 'secret-api-key', 'video_task_123');

        $this->assertCount(2, $logger->records);
        $this->assertSame('wuyin video query request', $logger->records[0]['message']);
        $this->assertSame('wuyin video query response', $logger->records[1]['message']);
        $this->assertSame('/api/async/detail', $logger->records[0]['context']['endpoint']);
        $this->assertSame(2, $logger->records[1]['context']['provider_status']);
        $this->assertStringNotContainsString('secret-api-key', json_encode($logger->records, JSON_THROW_ON_ERROR));
    }

    public function testSubmitThrowsProviderVideoExceptionWithStructuredProviderMessageOnHttpError(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'bad request',
                new Request('POST', 'https://api.wuyinkeji.com/api/async/video_veo3.1_fast'),
                new Response(400, [], json_encode([
                    'code' => 400,
                    'msg' => 'size must match supported resolution',
                ], JSON_THROW_ON_ERROR)),
            ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $client = new WuyinVideoClient($clientFactory);

        $this->expectException(ProviderVideoException::class);
        $this->expectExceptionMessage('size must match supported resolution');
        $client->submit('https://api.wuyinkeji.com', 'secret-api-key', 'veo3.1_fast', ['prompt' => 'test']);
    }
}

final class RecordingLogger extends AbstractLogger
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
