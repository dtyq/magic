<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeVideoClient;
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
final class DashScopeVideoClientErrorTest extends TestCase
{
    public function testKnownBadRequestUsesSafeVideoErrorCodeAndMessage(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->method('post')->willThrowException(new RequestException(
            'provider raw message',
            new Request('POST', 'https://dashscope.example/v1/video'),
            new Response(400, [], json_encode([
                'code' => 'InvalidParameter.InvalidResolution',
                'message' => 'provider secret details',
            ], JSON_THROW_ON_ERROR)),
        ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new DashScopeRecordingLogger());

        try {
            (new DashScopeVideoClient($clientFactory, $loggerFactory))->post(
                'https://dashscope.example',
                'secret-api-key',
                '/v1/video',
                ['prompt' => 'test'],
            );
            self::fail('Expected ProviderVideoException.');
        } catch (ProviderVideoException $exception) {
            self::assertSame((string) VideoGenerateErrorCode::INVALID_PARAMETER->value, $exception->getErrorCode());
            self::assertSame('请求参数不合法，请检查后重试。', $exception->getMessage());
            self::assertFalse($exception->isRetry());
            self::assertStringNotContainsString('provider secret details', $exception->getMessage());
        }
    }

    public function testKnownAspectRatioErrorUsesSpecificVideoErrorCode(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->method('post')->willThrowException(new RequestException(
            'provider raw message',
            new Request('POST', 'https://dashscope.example/v1/video'),
            new Response(400, [], json_encode([
                'code' => 'InvalidParameter.InvalidAspectRatio',
                'message' => 'The aspect ratio is not supported.',
            ], JSON_THROW_ON_ERROR)),
        ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new DashScopeRecordingLogger());

        try {
            (new DashScopeVideoClient($clientFactory, $loggerFactory))->post(
                'https://dashscope.example',
                'secret-api-key',
                '/v1/video',
                ['prompt' => 'test'],
            );
            self::fail('Expected ProviderVideoException.');
        } catch (ProviderVideoException $exception) {
            self::assertSame((string) VideoGenerateErrorCode::INVALID_ASPECT_RATIO->value, $exception->getErrorCode());
            self::assertFalse($exception->isRetry());
        }
    }

    public function testRateLimitHttpErrorIsRetriable(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->method('get')->willThrowException(new RequestException(
            'too many requests',
            new Request('GET', 'https://dashscope.example/v1/video/task-1'),
            new Response(429, [], '{}'),
        ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new DashScopeRecordingLogger());

        try {
            (new DashScopeVideoClient($clientFactory, $loggerFactory))->get(
                'https://dashscope.example',
                'secret-api-key',
                '/v1/video/task-1',
            );
            self::fail('Expected ProviderVideoException.');
        } catch (ProviderVideoException $exception) {
            self::assertTrue($exception->isRetry());
            self::assertSame((string) VideoGenerateErrorCode::GENERAL_ERROR->value, $exception->getErrorCode());
        }
    }

    public function testTransientBusinessCodeIsRetriable(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->method('post')->willReturn(new Response(200, [], json_encode([
            'code' => 'Throttling',
            'message' => 'too many requests',
        ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new DashScopeRecordingLogger());

        try {
            (new DashScopeVideoClient($clientFactory, $loggerFactory))->post(
                'https://dashscope.example',
                'secret-api-key',
                '/v1/video',
                ['prompt' => 'test'],
            );
            self::fail('Expected ProviderVideoException.');
        } catch (ProviderVideoException $exception) {
            self::assertTrue($exception->isRetry());
            self::assertSame((string) VideoGenerateErrorCode::GENERAL_ERROR->value, $exception->getErrorCode());
        }
    }
}

final class DashScopeRecordingLogger extends AbstractLogger
{
    public function log($level, $message, array $context = []): void
    {
    }
}
