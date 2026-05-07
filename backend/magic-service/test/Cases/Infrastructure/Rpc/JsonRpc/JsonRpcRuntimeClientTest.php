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
use App\Infrastructure\Rpc\Protocol\JsonDataFormatter;
use App\Infrastructure\Transport\Ipc\Contract\FramedTransportInterface;
use App\Infrastructure\Transport\Ipc\Uds\DecodedFrameResult;
use Hyperf\Codec\Json;
use Hyperf\Coroutine\Coroutine;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use RuntimeException;

use function Hyperf\Coroutine\defer;

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

    public function testEncodePayloadShouldReuseDecodedFrameMetadataForReceivedResponses(): void
    {
        $client = $this->newClient();
        $decodedFrame = new DecodedFrameResult(
            payload: '{"jsonrpc":"2.0","id":7,"result":{"ok":true}}',
            rawJsonBytes: 321,
            frameBytes: 123,
            frameCodec: 'gzip',
        );

        [, $bytes, $truncated, $rawJsonBytes, $frameBytes, $frameCodec] = self::invokePrivate(
            $client,
            'encodePayload',
            [null, null, $decodedFrame]
        );

        $this->assertSame(strlen($decodedFrame->payload), $bytes);
        $this->assertFalse($truncated);
        $this->assertSame(321, $rawJsonBytes);
        $this->assertSame(123, $frameBytes);
        $this->assertSame('gzip', $frameCodec);
    }

    public function testHandleServerRequestShouldReleaseHandlerCoroutineBeforeResponseWriteCompletes(): void
    {
        $transport = new BlockingWriteFramedTransport();
        $client = $this->newClient($transport);
        $handlerReleased = false;

        $client->registerHandler('svc.test.blocking', static function () use (&$handlerReleased) {
            defer(static function () use (&$handlerReleased) {
                $handlerReleased = true;
            });

            return ['ok' => true];
        });

        self::invokePrivate($client, 'handleServerRequest', [[
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'svc.test.blocking',
            'params' => [],
        ], '{"jsonrpc":"2.0","id":1,"method":"svc.test.blocking","params":[]}']);

        $this->assertTrue($this->waitUntil(static fn () => $transport->writeStarted), '响应回写协程未启动');
        $this->assertTrue($handlerReleased, '业务协程应在响应写回完成前结束');
        $this->assertFalse($transport->writeFinished, '写回阻塞期间不应提前完成');

        $transport->releaseWrite();

        $this->assertTrue($this->waitUntil(static fn () => $transport->writeFinished), '响应回写协程未完成');
        $this->assertSame(['{"jsonrpc":"2.0","id":1,"result":{"ok":true}}'], $transport->writtenFrames);
    }

    public function testHandleServerRequestShouldReleaseHandlerCoroutineBeforeErrorWriteCompletes(): void
    {
        $transport = new BlockingWriteFramedTransport();
        $client = $this->newClient($transport);
        $handlerReleased = false;

        $client->registerHandler('svc.test.error', static function () use (&$handlerReleased) {
            defer(static function () use (&$handlerReleased) {
                $handlerReleased = true;
            });

            throw new RuntimeException('boom');
        });

        self::invokePrivate($client, 'handleServerRequest', [[
            'jsonrpc' => '2.0',
            'id' => 2,
            'method' => 'svc.test.error',
            'params' => [],
        ], '{"jsonrpc":"2.0","id":2,"method":"svc.test.error","params":[]}']);

        $this->assertTrue($this->waitUntil(static fn () => $transport->writeStarted), '错误响应回写协程未启动');
        $this->assertTrue($handlerReleased, '异常场景下业务协程也应先结束');
        $this->assertFalse($transport->writeFinished, '错误响应写回阻塞期间不应提前完成');

        $transport->releaseWrite();

        $this->assertTrue($this->waitUntil(static fn () => $transport->writeFinished), '错误响应回写协程未完成');
        $this->assertSame(['{"jsonrpc":"2.0","id":2,"error":{"code":-32603,"message":"boom"}}'], $transport->writtenFrames);
    }

    public function testConnectPerformsHandshakeSuccessfully(): void
    {
        $transport = new HandshakeAwareFramedTransport(true);
        $client = new JsonRpcRuntimeClient($transport, new JsonDataFormatter(), new ClientConfig(readTimeout: 1.0, heartbeatInterval: 0.0));

        $this->assertTrue($client->connect(true));
        $this->assertTrue($client->isConnected());
        $this->assertGreaterThan(0, count($transport->writtenFrames));
    }

    public function testConnectClosesTransportWhenHandshakeFails(): void
    {
        $transport = new HandshakeAwareFramedTransport(false);
        $client = new JsonRpcRuntimeClient($transport, new JsonDataFormatter(), new ClientConfig(readTimeout: 1.0, heartbeatInterval: 0.0));

        $this->assertFalse($client->connect(true));
        $this->assertFalse($client->isConnected());
        $this->assertSame(1, $transport->closeCalls);
    }

    private function newClient(?FramedTransportInterface $transport = null): JsonRpcRuntimeClient
    {
        $transport ??= $this->createMock(FramedTransportInterface::class);
        $formatter = $this->createMock(DataFormatterInterface::class);

        return new JsonRpcRuntimeClient($transport, $formatter, new ClientConfig());
    }

    private function waitUntil(callable $predicate, int $timeoutMs = 1000): bool
    {
        $deadline = microtime(true) + ($timeoutMs / 1000);

        do {
            if ($predicate()) {
                return true;
            }

            usleep(1000);
        } while (microtime(true) < $deadline);

        return (bool) $predicate();
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

final class BlockingWriteFramedTransport implements FramedTransportInterface
{
    public bool $writeStarted = false;

    public bool $writeFinished = false;

    /**
     * @var string[]
     */
    public array $writtenFrames = [];

    private bool $releaseWrite = false;

    public function connect(): void
    {
    }

    public function close(): void
    {
    }

    public function isConnected(): bool
    {
        return true;
    }

    public function readFrame(): DecodedFrameResult
    {
        throw new RuntimeException('not implemented');
    }

    public function writeFrame(string $payload): void
    {
        $this->writeStarted = true;

        while (! $this->releaseWrite) {
            Coroutine::sleep(0.001);
        }

        $this->writtenFrames[] = $payload;
        $this->writeFinished = true;
    }

    public function getEndpointLabel(): string
    {
        return 'blocking-test-transport';
    }

    public function releaseWrite(): void
    {
        $this->releaseWrite = true;
    }
}

final class HandshakeAwareFramedTransport implements FramedTransportInterface
{
    /** @var string[] */
    public array $writtenFrames = [];

    public int $closeCalls = 0;

    private bool $connected = false;

    /** @var DecodedFrameResult[] */
    private array $queuedFrames = [];

    public function __construct(
        private readonly bool $handshakeSucceeds,
    ) {
    }

    public function connect(): void
    {
        $this->connected = true;
    }

    public function close(): void
    {
        $this->connected = false;
        ++$this->closeCalls;
    }

    public function isConnected(): bool
    {
        return $this->connected;
    }

    public function readFrame(): DecodedFrameResult
    {
        $deadline = microtime(true) + 1.0;
        while ($this->connected && $this->queuedFrames === [] && microtime(true) < $deadline) {
            usleep(1000);
        }

        if ($this->queuedFrames === []) {
            throw new RuntimeException('no queued frame available');
        }

        return array_shift($this->queuedFrames);
    }

    public function writeFrame(string $payload): void
    {
        $this->writtenFrames[] = $payload;

        $request = Json::decode($payload);
        if (! is_array($request)) {
            return;
        }

        if (($request['method'] ?? null) !== 'ipc.hello') {
            return;
        }

        $response = [
            'jsonrpc' => '2.0',
            'id' => $request['id'] ?? 1,
        ];

        if ($this->handshakeSucceeds) {
            $response['result'] = ['ok' => true];
        } else {
            $response['error'] = [
                'code' => -32001,
                'message' => 'handshake failed',
            ];
        }

        $payload = Json::encode($response);
        $this->queuedFrames[] = new DecodedFrameResult(
            payload: $payload,
            rawJsonBytes: strlen($payload),
            frameBytes: 77,
            frameCodec: 'gzip',
        );
    }

    public function getEndpointLabel(): string
    {
        return 'handshake-aware-transport';
    }
}
