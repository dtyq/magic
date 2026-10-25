<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini;

use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\GeminiVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;
use RuntimeException;

/**
 * @internal
 */
final class GeminiVideoClientTest extends TestCase
{
    public function testPostUsesGeminiApiKeyHeaderAndNormalizesPath(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://generativelanguage.googleapis.com/v1beta/interactions',
                [
                    'headers' => [
                        'x-goog-api-key' => 'secret-api-key',
                        'Content-Type' => 'application/json',
                    ],
                    'json' => ['model' => 'gemini-omni-1.1-flash'],
                ],
            )
            ->willReturn(new Response(200, ['x-request-id' => ['req-gemini-1']], json_encode([
                'id' => 'interaction-1',
                'status' => 'queued',
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())->method('create')->with(['timeout' => 30, 'verify' => true])->willReturn($httpClient);
        $logger = new GeminiRecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($this->once())->method('get')->with(GeminiVideoClient::class)->willReturn($logger);

        $result = (new GeminiVideoClient($clientFactory, $loggerFactory))->post(
            'https://generativelanguage.googleapis.com/v1beta/',
            'secret-api-key',
            '/interactions',
            ['model' => 'gemini-omni-1.1-flash'],
            ['operation_id' => 'op-1'],
        );

        self::assertSame('interaction-1', $result['id']);
        self::assertSame('op-1', $logger->records[0]['context']['context']['operation_id']);
        self::assertSame('req-gemini-1', $logger->records[1]['context']['provider_request_id']);
        self::assertStringNotContainsString('secret-api-key', json_encode($logger->records, JSON_THROW_ON_ERROR));
    }

    public function testGetEncodesInteractionIdAndParsesJson(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://gemini.example/v1/interactions/interaction%2F1',
                [
                    'headers' => [
                        'x-goog-api-key' => 'secret-api-key',
                        'Content-Type' => 'application/json',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], '{"id":"interaction/1","status":"completed"}'));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new GeminiRecordingLogger());

        $result = (new GeminiVideoClient($clientFactory, $loggerFactory))->get(
            'https://gemini.example/v1',
            'secret-api-key',
            '/interactions/' . rawurlencode('interaction/1'),
        );

        self::assertSame('completed', $result['status']);
    }

    /** @dataProvider nonRetriableStatusProvider */
    public function testKnownNonRetriableHttpErrorsAreMapped(int $status, string $providerCode, int $errorCode): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->method('post')->willThrowException(new RequestException(
            'provider raw message',
            new Request('POST', 'https://gemini.example/v1/interactions'),
            new Response($status, [], json_encode(['error' => ['code' => $providerCode, 'message' => 'secret']], JSON_THROW_ON_ERROR)),
        ));
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new GeminiRecordingLogger());

        try {
            (new GeminiVideoClient($clientFactory, $loggerFactory))->post('https://gemini.example/v1', 'secret-api-key', '/interactions', []);
            self::fail('Expected ProviderVideoException.');
        } catch (ProviderVideoException $exception) {
            self::assertSame((string) $errorCode, $exception->getErrorCode());
            self::assertFalse($exception->isRetry());
            self::assertStringNotContainsString('secret', $exception->getMessage());
        }
    }

    public static function nonRetriableStatusProvider(): array
    {
        return [
            'bad request' => [400, 'INVALID_ARGUMENT', VideoGenerateErrorCode::INVALID_PARAMETER->value],
            'unauthorized' => [401, 'UNAUTHENTICATED', VideoGenerateErrorCode::GENERAL_ERROR->value],
            'forbidden' => [403, 'PERMISSION_DENIED', VideoGenerateErrorCode::GENERAL_ERROR->value],
        ];
    }

    public function testRateLimitAndServerErrorsAreRetriable(): void
    {
        foreach ([[429, VideoGenerateErrorCode::GENERAL_ERROR], [500, VideoGenerateErrorCode::GENERAL_ERROR]] as [$status, $expectedCode]) {
            $httpClient = $this->createMock(Client::class);
            $httpClient->method('get')->willThrowException(new RequestException(
                'provider raw message',
                new Request('GET', 'https://gemini.example/v1/interactions/i-1'),
                new Response($status, [], '{}'),
            ));
            $clientFactory = $this->createMock(ClientFactory::class);
            $clientFactory->method('create')->willReturn($httpClient);
            $loggerFactory = $this->createMock(LoggerFactory::class);
            $loggerFactory->method('get')->willReturn(new GeminiRecordingLogger());

            try {
                (new GeminiVideoClient($clientFactory, $loggerFactory))->get('https://gemini.example/v1', 'key', '/interactions/i-1');
                self::fail('Expected ProviderVideoException.');
            } catch (ProviderVideoException $exception) {
                self::assertTrue($exception->isRetry());
                self::assertSame((string) $expectedCode->value, $exception->getErrorCode());
            }
        }
    }

    public function testRequestFailureLogsProviderResponseBody(): void
    {
        $responseBody = '{"error":{"code":"invalid_request","message":"aspect ratio is not supported"}}';
        $response = new Response(400, [], $responseBody);
        $httpClient = $this->createMock(Client::class);
        $httpClient->method('post')->willThrowException(new RequestException(
            'provider raw message',
            new Request('POST', 'https://gemini.example/v1/interactions'),
            $response,
        ));
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $logger = new GeminiRecordingLogger();
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        try {
            (new GeminiVideoClient($clientFactory, $loggerFactory))->post(
                'https://gemini.example/v1',
                'secret-api-key',
                '/interactions',
                [],
            );
            self::fail('Expected ProviderVideoException.');
        } catch (ProviderVideoException) {
            $errorRecord = array_values(array_filter(
                $logger->records,
                static fn (array $record): bool => $record['message'] === 'gemini video request failed',
            ))[0] ?? [];
            self::assertSame('gemini video request failed', $errorRecord['message'] ?? null);
            self::assertSame($responseBody, $errorRecord['context']['response'] ?? null);
            self::assertSame($responseBody, (string) $response->getBody()->getContents());
        }
    }

    public function testConnectivityFailureThrowsRawProviderResponse(): void
    {
        $responseBody = '{"error":{"code":"invalid_request","message":"aspect ratio is not supported"}}';
        $httpClient = $this->createMock(Client::class);
        $httpClient->method('post')->willThrowException(new RequestException(
            'provider raw message',
            new Request('POST', 'https://gemini.example/v1/interactions'),
            new Response(400, [], $responseBody),
        ));
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new GeminiRecordingLogger());

        try {
            (new GeminiVideoClient($clientFactory, $loggerFactory))->post(
                'https://gemini.example/v1',
                'secret-api-key',
                '/interactions',
                [],
                ['connectivity_test' => true],
            );
            self::fail('Expected ProviderVideoException.');
        } catch (ProviderVideoException $exception) {
        }
    }

    public function testInvalidJsonAndEmptyBodyUseRetriableResponseFormatError(): void
    {
        foreach (['not-json', ''] as $body) {
            $httpClient = $this->createMock(Client::class);
            $httpClient->method('post')->willReturn(new Response(200, [], $body));
            $clientFactory = $this->createMock(ClientFactory::class);
            $clientFactory->method('create')->willReturn($httpClient);
            $loggerFactory = $this->createMock(LoggerFactory::class);
            $loggerFactory->method('get')->willReturn(new GeminiRecordingLogger());

            try {
                (new GeminiVideoClient($clientFactory, $loggerFactory))->post('https://gemini.example/v1', 'key', '/interactions', []);
                self::fail('Expected ProviderVideoException.');
            } catch (ProviderVideoException $exception) {
                self::assertTrue($exception->isRetry());
                self::assertSame((string) VideoGenerateErrorCode::RESPONSE_FORMAT_ERROR->value, $exception->getErrorCode());
            }
        }
    }

    public function testNetworkErrorIsRetriableAndUsesGenericMessage(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->method('get')->willThrowException(new RuntimeException('provider network secret'));
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new GeminiRecordingLogger());

        try {
            (new GeminiVideoClient($clientFactory, $loggerFactory))->get('https://gemini.example/v1', 'key', '/interactions/i-1');
            self::fail('Expected ProviderVideoException.');
        } catch (ProviderVideoException $exception) {
            self::assertTrue($exception->isRetry());
            self::assertSame((string) VideoGenerateErrorCode::GENERAL_ERROR->value, $exception->getErrorCode());
            self::assertStringNotContainsString('provider network secret', $exception->getMessage());
        }
    }

    public function testDownloadMediaDoesNotForwardApiKeyAcrossRedirectOrigin(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->exactly(2))
            ->method('get')
            ->willReturnCallback(function (string $url, array $options) {
                static $call = 0;
                ++$call;
                if ($call === 1) {
                    self::assertSame('secret-api-key', $options['headers']['x-goog-api-key'] ?? null);
                    self::assertFalse($options['allow_redirects']);
                    return new Response(302, ['Location' => 'https://www.gstatic.com/video.mp4']);
                }

                self::assertArrayNotHasKey('x-goog-api-key', $options['headers']);
                return new Response(200, ['Content-Type' => 'video/mp4'], 'video-bytes');
            });
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new GeminiRecordingLogger());

        $result = (new GeminiVideoClient($clientFactory, $loggerFactory))->downloadMedia(
            'https://www.google.com/v1',
            'secret-api-key',
            '/media/video.mp4',
        );

        self::assertSame(base64_encode('video-bytes'), $result['bytes_base64_encoded']);
    }

    public function testDownloadMediaNeverRestoresApiKeyAfterCrossOriginRedirect(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->exactly(4))
            ->method('get')
            ->willReturnCallback(function (string $url, array $options) {
                static $call = 0;
                ++$call;
                if ($call === 1) {
                    self::assertSame('secret-api-key', $options['headers']['x-goog-api-key'] ?? null);
                    return new Response(302, ['Location' => 'https://www.google.com/video/step-2']);
                }
                if ($call === 2) {
                    self::assertSame('secret-api-key', $options['headers']['x-goog-api-key'] ?? null);
                    return new Response(302, ['Location' => 'https://www.gstatic.com/video/step-3']);
                }
                if ($call === 3) {
                    self::assertArrayNotHasKey('x-goog-api-key', $options['headers']);
                    return new Response(302, ['Location' => 'https://www.google.com/video/step-4']);
                }

                self::assertArrayNotHasKey('x-goog-api-key', $options['headers']);
                return new Response(200, ['Content-Type' => 'video/mp4'], 'video-bytes');
            });
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new GeminiRecordingLogger());

        $result = (new GeminiVideoClient($clientFactory, $loggerFactory))->downloadMedia(
            'https://www.google.com/v1',
            'secret-api-key',
            '/media/video.mp4',
        );

        self::assertSame(base64_encode('video-bytes'), $result['bytes_base64_encoded']);
    }

    public function testDownloadMediaRejectsBodyLargerThan100Mb(): void
    {
        $previousMemoryLimit = ini_get('memory_limit');
        ini_set('memory_limit', '512M');
        $body = tmpfile();
        self::assertIsResource($body);
        ftruncate($body, 100 * 1024 * 1024 + 1);
        rewind($body);
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->willReturn(new Response(200, ['Content-Type' => 'video/mp4'], $body));
        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->method('create')->willReturn($httpClient);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new GeminiRecordingLogger());

        try {
            $this->expectException(ProviderVideoException::class);
            (new GeminiVideoClient($clientFactory, $loggerFactory))->downloadMedia(
                'https://www.google.com/v1',
                'secret-api-key',
                '/media/video.mp4',
            );
        } finally {
            ini_set('memory_limit', (string) $previousMemoryLimit);
        }
    }
}

final class GeminiRecordingLogger extends AbstractLogger
{
    /** @var array<int, array{level: string, message: string, context: array<mixed>}> */
    public array $records = [];

    public function log($level, $message, array $context = []): void
    {
        $this->records[] = ['level' => (string) $level, 'message' => (string) $message, 'context' => $context];
    }
}
