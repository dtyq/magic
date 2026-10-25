<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\ModelGateway\Assembler;

use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Interfaces\ModelGateway\Assembler\LLMAssembler;
use Generator;
use GuzzleHttp\Psr7\Response;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\Request\ChatCompletionRequest;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Transport\SSEEvent;
use Hyperf\Odin\Api\Transport\SseEventProducerInterface;
use Hyperf\Odin\Event\AfterChatCompletionsStreamEvent;
use Hyperf\Odin\Exception\LLMException;
use Hyperf\Odin\Exception\LLMException\LLMApiException;
use HyperfTest\Support\ModelGateway\RecordingWritable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\NullLogger;
use RuntimeException;
use Swow\SocketException;
use Throwable;

/** 使用真实Odin解析、聚合与完成事件验证断连后的尾帧消费。
 * @internal
 */
class LLMAssemblerClientDisconnectTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    /** 保存测试前容器，避免污染其他单元测试。 */
    protected function setUp(): void
    {
        if (ApplicationContext::hasContainer()) {
            $this->previousContainer = ApplicationContext::getContainer();
        }
    }

    /** 清理请求上下文并恢复原容器。 */
    protected function tearDown(): void
    {
        Context::destroy('LLMAssembler::EventStream');
        if ($this->previousContainer) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    /** 同一个SSE源必须读到尾部，原完成事件只派发一次且携带最终usage。 */
    #[DataProvider('disconnectCases')]
    public function testDisconnectKeepsUpstreamCompletion(bool $headers, ?int $failAt, bool $end, bool $socket): void
    {
        $writer = new RecordingWritable();
        $writer->failHeaders = $headers;
        $writer->failWriteAt = $failAt;
        $writer->failEnd = $end;
        $writer->error = $socket ? new SocketException('mock disconnected') : null;
        $usage = ['prompt_tokens' => 3, 'completion_tokens' => 7, 'total_tokens' => 10];
        $response = $this->runStream($writer, $usage);
        self::assertSame(10, $response->getUsage()->getTotalTokens());
        self::assertSame(4, count($response->getChoices()));
        self::assertSame(1, $writer->headerAttempts);
        self::assertSame($headers ? 0 : ($failAt ?? 6), $writer->writeAttempts);
        self::assertSame($headers || $failAt !== null ? 0 : 1, $writer->endAttempts);
        if (! $headers && $failAt === null) {
            $frames = $writer->writes;
            self::assertSame("data: [DONE]\n\n", $frames[5]);
            $tool = json_decode(substr($frames[1], 6), true)['choices'][0]['delta']['tool_calls'][0];
            self::assertSame(3, $tool['index']);
            self::assertSame('{"text":', $tool['function']['arguments']);
            self::assertSame(10, json_decode(substr($frames[4], 6), true)['usage']['total_tokens']);
        }
    }

    /** 覆盖正常、写头、文本、工具、usage、DONE及结束阶段。 */
    public static function disconnectCases(): iterable
    {
        yield 'normal' => [false, null, false, false];
        yield 'headers' => [true, null, false, false];
        foreach ([1, 2, 3, 5, 6] as $at) {
            yield 'false-at-' . $at => [false, $at, false, false];
            yield 'socket-at-' . $at => [false, $at, false, true];
        }
        yield 'end-false' => [false, null, true, false];
        yield 'end-socket' => [false, null, true, true];
    }

    /** 缺失usage和服务商明确返回零必须保留各自语义。 */
    public function testMissingAndZeroUsageRemainDistinct(): void
    {
        foreach ([null, ['prompt_tokens' => 0, 'completion_tokens' => 0, 'total_tokens' => 0]] as $usage) {
            $writer = new RecordingWritable();
            $writer->failWriteAt = 1;
            $response = $this->runStream($writer, $usage);
            self::assertSame($usage === null ? null : 0, $response->getUsage()?->getTotalTokens());
        }
    }

    /** 上游错误保持目标分支已有的SSE错误收尾，不能输出成功DONE。 */
    public function testUpstreamErrorsKeepExistingErrorProtocol(): void
    {
        foreach ([new LLMApiException('mock provider', statusCode: 503), new SocketException('mock upstream'), new RuntimeException('mock timeout'), new RuntimeException('mock cancellation')] as $error) {
            foreach ([false, true] as $detached) {
                $writer = new RecordingWritable();
                $writer->failWriteAt = $detached ? 1 : null;
                $this->runStream($writer, null, $error);
                self::assertStringNotContainsString('[DONE]', implode('', $writer->writes));
                if ($detached) {
                    self::assertSame(1, $writer->writeAttempts);
                    self::assertSame(0, $writer->endAttempts);
                } else {
                    $frame = json_decode(substr($writer->writes[1], 6), true);
                    self::assertSame($error instanceof LLMException ? 'upstream_stream_error' : 'stream_response_error', $frame['error']['code']);
                    self::assertTrue($frame['error']['partial']);
                    self::assertFalse($frame['error']['retryable']);
                    self::assertSame(1, $writer->endAttempts);
                }
            }
        }
    }

    /** 服务商原生错误经过真实Odin解析后不得冒充成功，也不得泄露原始错误。 */
    public function testProviderErrorChunksDoNotDispatchSuccessfulCompletion(): void
    {
        $chunks = [
            ['error' => ['message' => 'mock-private-provider-detail', 'code' => 'server_error']],
            ['choices' => [['index' => 0, 'delta' => [], 'finish_reason' => 'error', 'native_finish_reason' => 'mock-private-provider-detail']]],
        ];
        foreach ($chunks as $chunk) {
            foreach ([false, true] as $detached) {
                $writer = new RecordingWritable();
                $writer->failWriteAt = $detached ? 1 : null;
                $response = $this->runStream($writer, null, errorChunk: $chunk);
                self::assertFalse($response->isSuccess());
                self::assertNull($response->getUsage());
                self::assertStringNotContainsString('[DONE]', implode('', $writer->writes));
                self::assertStringNotContainsString('mock-private-provider-detail', implode('', $writer->writes));
                if ($detached) {
                    self::assertSame(1, $writer->writeAttempts);
                    self::assertSame(0, $writer->endAttempts);
                } else {
                    $frame = json_decode(substr($writer->writes[1], 6), true);
                    self::assertSame('upstream_stream_error', $frame['error']['code']);
                    self::assertTrue($frame['error']['partial']);
                    self::assertFalse($frame['error']['retryable']);
                    self::assertSame(1, $writer->endAttempts);
                }
            }
        }
    }

    /** 运行真实响应对象，仅替换SSE输入、下游连接及事件派发器。 */
    private function runStream(RecordingWritable $writer, ?array $usage, ?Throwable $error = null, ?array $errorChunk = null): ChatCompletionStreamResponse
    {
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($errorChunk === null ? self::once() : self::never())->method('dispatch')->willReturnCallback(static function (object $event) use ($usage, $error): object {
            self::assertInstanceOf(AfterChatCompletionsStreamEvent::class, $event);
            // Odin既有finally也可能在读取失败时派发，本需求不改变该契约。
            if ($error === null) {
                self::assertSame($usage === null ? null : $usage['total_tokens'], $event->getCompletionResponse()->getUsage()?->getTotalTokens());
                self::assertSame('mock text', $event->getCompletionResponse()->getFirstChoice()->getMessage()->getContent());
            }
            return $event;
        });
        $factory = $this->createMock(LoggerFactory::class);
        $factory->method('get')->willReturn(new NullLogger());
        $httpResponse = new class($writer) extends Response {
            /** 注入内存连接，避免启动HTTP服务。 */
            public function __construct(private RecordingWritable $writer)
            {
                parent::__construct(200);
            }

            /** 为真实组装器工厂提供内存连接。 */
            public function getConnection(): RecordingWritable
            {
                return $this->writer;
            }
        };
        $container = $this->createMock(ContainerInterface::class);
        $container->method('has')->willReturn(true);
        $container->method('get')->willReturnMap([
            [EventDispatcherInterface::class, $dispatcher],
            [LoggerFactory::class, $factory],
            [ResponseInterface::class, $httpResponse],
        ]);
        ApplicationContext::setContainer($container);
        $producer = $this->createMock(SseEventProducerInterface::class);
        $producer->expects(self::once())->method('getIterator')->willReturnCallback(static function () use ($usage, $error, $errorChunk): Generator {
            $deltas = [
                ['role' => 'assistant', 'content' => 'mock text'],
                ['tool_calls' => [['index' => 3, 'id' => 'mock-call', 'type' => 'function', 'function' => ['name' => 'mock_tool', 'arguments' => '{"text":']]]],
                ['tool_calls' => [['index' => 3, 'function' => ['arguments' => '"mock"}']]]],
                ['content' => ''],
            ];
            foreach ($deltas as $index => $delta) {
                yield new SSEEvent(['id' => 'mock-response', 'model' => 'mock-model', 'created' => 1, 'choices' => [
                    ['index' => 0, 'delta' => $delta, 'finish_reason' => $index === 3 ? 'tool_calls' : null],
                ]]);
                if ($errorChunk !== null) {
                    yield new SSEEvent($errorChunk);
                    return;
                }
                if ($error) {
                    throw $error;
                }
            }
            if ($usage !== null) {
                yield new SSEEvent(['choices' => [], 'usage' => $usage]);
            }
            yield new SSEEvent('[DONE]');
        });
        $producer->expects($error || $errorChunk !== null ? self::never() : self::once())->method('closeEarly');
        $response = new ChatCompletionStreamResponse(streamIterator: $producer);
        $response->setAfterChatCompletionsStreamEvent(new AfterChatCompletionsStreamEvent($this->createMock(ChatCompletionRequest::class), 0));
        Context::destroy('LLMAssembler::EventStream');
        $dto = new CompletionDTO(['model' => 'mock-model']);
        $dto->setStream(true);
        $dto->setStreamOptions(['include_usage' => true]);
        LLMAssembler::createStreamResponseByChatCompletionResponse($dto, $response);
        return $response;
    }
}
