<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\ErrorCode\VideoGenerateErrorCode;
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
    public function testPostUsesExtendedRequestTimeout(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willReturn(new Response(200, [], json_encode(['id' => 'task-1'], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->with(['timeout' => 180])
            ->willReturn($httpClient);

        $logger = new VolcengineArkRecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(VolcengineArkVideoClient::class)
            ->willReturn($logger);

        $client = new VolcengineArkVideoClient($clientFactory, $loggerFactory);

        $response = $client->post(
            'https://ark.cn-beijing.volces.com/api/v3',
            'secret-api-key',
            '/contents/generations/tasks',
            ['model' => 'doubao-seedance-2-0-fast-260128'],
        );

        $this->assertSame('task-1', $response['id']);
        $this->assertSame(['model' => 'doubao-seedance-2-0-fast-260128'], $logger->records[0]['context']['payload']);
        $this->assertSame(['id' => 'task-1'], $logger->records[1]['context']['response']);
    }

    public function testPostReturnsGenericFriendlyMessageForUnmappedArkError(): void
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
        $this->expectExceptionMessage(VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
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
            $this->assertSame('{"error":{"message":"service_tier must be empty"}}', $logger->records[1]['context']['response']);
            $this->assertSame(VideoGenerateErrorCode::GENERAL_ERROR->value, $logger->records[1]['context']['error_code']);
            $this->assertSame('bad request', $logger->records[1]['context']['error_message']);
        }
    }

    public function testGetMarksResourceNotFoundAsNonRetriable(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->willThrowException(new RequestException(
                'not found',
                new Request('GET', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/missing-task'),
                new Response(404, [], json_encode([
                    'error' => [
                        'code' => 'ResourceNotFound',
                        'message' => 'The specified resource `missing-task` is not found.',
                    ],
                ], JSON_THROW_ON_ERROR)),
            ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(VolcengineArkVideoClient::class)
            ->willReturn(new VolcengineArkRecordingLogger());

        $client = new VolcengineArkVideoClient($clientFactory, $loggerFactory);

        try {
            $client->get(
                'https://ark.cn-beijing.volces.com/api/v3',
                'secret-api-key',
                '/contents/generations/tasks/missing-task',
                ['operation_id' => 'op-resource-not-found'],
            );
            self::fail('Expected ProviderVideoException was not thrown.');
        } catch (ProviderVideoException $exception) {
            $this->assertFalse($exception->isRetry());
            $this->assertSame(404, $exception->getHttpStatus());
            $this->assertNotSame('', $exception->getMessage());
        }
    }

    public function testPostReturnsFriendlyMessageForPrivacyRiskCode(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'bad request',
                new Request('POST', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'),
                new Response(400, [], json_encode([
                    'error' => [
                        'code' => 'InputVideoSensitiveContentDetected.PrivacyInformation',
                        'message' => 'The request failed because the input video may contain real person.',
                    ],
                ], JSON_THROW_ON_ERROR)),
            ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(VolcengineArkVideoClient::class)
            ->willReturn(new VolcengineArkRecordingLogger());

        $client = new VolcengineArkVideoClient($clientFactory, $loggerFactory);

        $this->expectException(ProviderVideoException::class);
        $this->expectExceptionMessage(VideoGenerateErrorCode::INPUT_VIDEO_PRIVACY_FAILED->getMessage());

        $client->post(
            'https://ark.cn-beijing.volces.com/api/v3',
            'secret-api-key',
            '/contents/generations/tasks',
            ['model' => 'doubao-seedance-2-0-fast-260128'],
        );
    }

    public function testPostPreservesRequestExceptionResponseBodyForDownstreamHandling(): void
    {
        $errorResponse = json_encode([
            'error' => [
                'code' => 'InputImageSensitiveContentDetected.PrivacyInformation',
                'message' => "The request failed because the input image 'content[1]' may contain real person. Request id: 0217870408693852d028257773b48b117f8c4bedc94f46b62987e",
                'param' => '',
                'type' => 'BadRequest',
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        $httpClient = $this->createMock(Client::class);
        $httpClient
            ->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'bad request',
                new Request('POST', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'),
                new Response(400, [], $errorResponse),
            ));

        $logger = new VolcengineArkRecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory
            ->expects($this->once())
            ->method('get')
            ->with(VolcengineArkVideoClient::class)
            ->willReturn($logger);

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory
            ->expects($this->once())
            ->method('create')
            ->with(['timeout' => 180])
            ->willReturn($httpClient);

        $client = new VolcengineArkVideoClient($clientFactory, $loggerFactory);

        try {
            $client->post(
                'https://ark.cn-beijing.volces.com/api/v3',
                'secret-api-key',
                '/contents/generations/tasks',
                ['model' => 'doubao-seedance-2-0-260128'],
                ['operation_id' => 'bcbecba1-17f9-4f38-8ac3-f518cf279a0c'],
            );
            self::fail('Expected ProviderVideoException was not thrown.');
        } catch (ProviderVideoException $exception) {
            $previous = $exception->getPrevious();
            self::assertSame(VideoGenerateErrorCode::INPUT_IMAGE_PRIVACY_FAILED->getMessage(), $exception->getMessage());
            self::assertSame(VideoGenerateErrorCode::INPUT_IMAGE_PRIVACY_FAILED, $exception->getVideoErrorCode());
            self::assertInstanceOf(RequestException::class, $previous);
            self::assertSame($errorResponse, $previous->getResponse()?->getBody()->getContents());
        }
    }

    public function testPostReturnsGenericInvalidParameterMessageWhenNoHintMatched(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'original invalid parameter message',
                new Request('POST', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'),
                new Response(400, [], json_encode([
                    'error' => [
                        'code' => 'InvalidParameter',
                        'message' => 'Error while downloading image.',
                    ],
                ], JSON_THROW_ON_ERROR)),
            ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(VolcengineArkVideoClient::class)
            ->willReturn(new VolcengineArkRecordingLogger());

        $client = new VolcengineArkVideoClient($clientFactory, $loggerFactory);

        try {
            $client->post(
                'https://ark.cn-beijing.volces.com/api/v3',
                'secret-api-key',
                '/contents/generations/tasks',
                ['model' => 'doubao-seedance-2-0-260128'],
            );
            self::fail('Expected ProviderVideoException was not thrown.');
        } catch (ProviderVideoException $exception) {
            self::assertSame(VideoGenerateErrorCode::INVALID_PARAMETER->getMessage(), $exception->getMessage());
            self::assertSame(VideoGenerateErrorCode::INVALID_PARAMETER, $exception->getVideoErrorCode());
        }
    }

    public function testPostReturnsFriendlyMessageForOutputSensitiveContentCode(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'original sensitive content message',
                new Request('POST', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'),
                new Response(400, [], json_encode([
                    'error' => ['code' => 'OutputVideoSensitiveContentDetected.PolicyViolation'],
                ], JSON_THROW_ON_ERROR)),
            ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())->method('get')->with(VolcengineArkVideoClient::class)
            ->willReturn(new VolcengineArkRecordingLogger());
        $client = new VolcengineArkVideoClient($clientFactory, $loggerFactory);

        try {
            $client->post('https://ark.cn-beijing.volces.com/api/v3', 'secret-api-key', '/contents/generations/tasks', ['model' => 'model']);
            self::fail('Expected ProviderVideoException was not thrown.');
        } catch (ProviderVideoException $exception) {
            self::assertSame(
                VideoGenerateErrorCode::OUTPUT_VIDEO_SENSITIVE_CONTENT_DETECTED_POLICY_VIOLATION->getMessage(),
                $exception->getMessage(),
            );
        }
    }

    public function testPostReturnsFriendlyMessageForInvalidParameterCode(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'bad request',
                new Request('POST', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'),
                new Response(400, [], json_encode([
                    'error' => [
                        'code' => 'InvalidParameter.InvalidResolution',
                        'message' => 'Invalid resolution, support 480p/720p only.',
                    ],
                ], JSON_THROW_ON_ERROR)),
            ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())
            ->method('get')
            ->with(VolcengineArkVideoClient::class)
            ->willReturn(new VolcengineArkRecordingLogger());

        $client = new VolcengineArkVideoClient($clientFactory, $loggerFactory);

        $this->expectException(ProviderVideoException::class);
        $this->expectExceptionMessage(VideoGenerateErrorCode::INVALID_PARAMETER_INVALID_RESOLUTION->getMessage());

        $client->post(
            'https://ark.cn-beijing.volces.com/api/v3',
            'secret-api-key',
            '/contents/generations/tasks',
            ['model' => 'doubao-seedance-2-0-fast-260128'],
        );
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
        $this->assertSame([
            'id' => 'task-1',
            'status' => 'running',
        ], $logger->records[1]['context']['response']);
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
