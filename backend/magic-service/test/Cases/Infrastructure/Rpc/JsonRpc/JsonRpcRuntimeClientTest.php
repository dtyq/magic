<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\JsonRpc;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Rpc\JsonRpc\ClientConfig;
use App\Infrastructure\Rpc\JsonRpc\JsonRpcRuntimeClient;
use App\Infrastructure\Rpc\Protocol\Contract\DataFormatterInterface;
use App\Infrastructure\Transport\Ipc\Contract\FramedTransportInterface;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @internal
 */
class JsonRpcRuntimeClientTest extends TestCase
{
    private const int LOG_PAYLOAD_LIMIT = 4096;

    public function testBuildRemoteErrorExceptionShouldExposeRemoteCodeAndMessage(): void
    {
        $client = $this->newClient();

        $exception = self::invokePrivate(
            $client,
            'buildRemoteErrorException',
            [[
                'error' => [
                    'code' => 31005,
                    'message' => 'vector dimension mismatch: expected 1024, got 3072',
                ],
            ]]
        );

        $this->assertInstanceOf(BusinessException::class, $exception);
        $this->assertSame(31005, $exception->getCode());
        $this->assertSame('vector dimension mismatch: expected 1024, got 3072', $exception->getMessage());
    }

    public function testBuildRemoteErrorExceptionShouldKeepInternalErrorMessageFor5000(): void
    {
        $client = $this->newClient();

        $exception = self::invokePrivate(
            $client,
            'buildRemoteErrorException',
            [[
                'error' => [
                    'code' => 5000,
                    'message' => '内部错误',
                ],
            ]]
        );

        $this->assertInstanceOf(BusinessException::class, $exception);
        $this->assertSame(5000, $exception->getCode());
        $this->assertSame('内部错误', $exception->getMessage());
    }

    public function testEncodePayloadShouldKeepFullJsonWhenWithinLimit(): void
    {
        $client = $this->newClient();

        $payload = [
            'method' => 'svc.file.getLink',
            'params' => ['path' => 'foo/bar.md'],
        ];

        [$text, $bytes, $truncated] = self::invokePrivate($client, 'encodePayload', [$payload]);

        $this->assertSame('{"method":"svc.file.getLink","params":{"path":"foo\/bar.md"}}', $text);
        $this->assertSame(strlen($text), $bytes);
        $this->assertFalse($truncated);
    }

    public function testEncodePayloadShouldReturnPlaceholderForOversizedUtf8Payload(): void
    {
        $client = $this->newClient();

        $payload = [
            'method' => 'svc.modelGateway.embedding.compute',
            'params' => [
                'input' => [str_repeat('中文内容', 1200)],
            ],
        ];

        [$text, $bytes, $truncated] = self::invokePrivate($client, 'encodePayload', [$payload]);

        $this->assertSame('...(truncated)', $text);
        $this->assertGreaterThan(self::LOG_PAYLOAD_LIMIT, $bytes);
        $this->assertTrue($truncated);
    }

    public function testEncodePayloadShouldReturnPlaceholderForOversizedEncodedPayload(): void
    {
        $client = $this->newClient();

        $encodedPayload = '{"message":"' . str_repeat('中文内容', 1200) . '"}';

        [$text, $bytes, $truncated] = self::invokePrivate($client, 'encodePayload', [null, $encodedPayload]);

        $this->assertSame('...(truncated)', $text);
        $this->assertGreaterThan(self::LOG_PAYLOAD_LIMIT, $bytes);
        $this->assertTrue($truncated);
    }

    private function newClient(): JsonRpcRuntimeClient
    {
        $transport = $this->createMock(FramedTransportInterface::class);
        $formatter = $this->createMock(DataFormatterInterface::class);

        return new JsonRpcRuntimeClient($transport, $formatter, new ClientConfig());
    }

    /**
     * @param array<int, mixed> $arguments
     */
    private static function invokePrivate(object $instance, string $method, array $arguments): mixed
    {
        $reflection = new ReflectionMethod($instance, $method);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($instance, $arguments);
    }
}
