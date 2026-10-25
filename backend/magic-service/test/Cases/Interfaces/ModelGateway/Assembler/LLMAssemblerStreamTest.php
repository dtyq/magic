<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\ModelGateway\Assembler;

use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Infrastructure\Core\Hyperf\EventStream;
use App\Interfaces\ModelGateway\Assembler\LLMAssembler;
use Hyperf\Context\Context;
use Hyperf\Odin\Api\Response\ChatCompletionChoice;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Exception\LLMException\LLMApiException;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Throwable;

/** 验证真实组装器在正常、异常和断开场景的响应收尾。
 * @internal
 */
class LLMAssemblerStreamTest extends TestCase
{
    /** 清理流上下文，所有输入均为合成数据。 */
    protected function tearDown(): void
    {
        Context::destroy('LLMAssembler::EventStream');
    }

    /** 正常流仍发送DONE且只结束一次。 */
    public function testNormalStreamKeepsCompletionProtocol(): void
    {
        $stream = $this->runStream('mock text', null);
        self::assertStringContainsString('data: [DONE]', implode('', $stream->writes));
        self::assertSame(1, $stream->ends);
        self::assertSame(1, $stream->closes);
    }

    /** 部分输出后的错误必须为SSE错误，而非成功或敏感异常全文。 */
    public function testPartialStreamErrorIsSanitizedAndEnded(): void
    {
        $stream = $this->runStream('0', new LLMApiException('secret-placeholder', statusCode: 200));
        $payload = json_decode(substr($stream->writes[1], 6), true);
        self::assertTrue($payload['error']['partial']);
        self::assertFalse($payload['error']['retryable']);
        self::assertSame('upstream_stream_error', $payload['error']['code']);
        self::assertStringNotContainsString('secret-placeholder', implode('', $stream->writes));
        self::assertStringNotContainsString('[DONE]', implode('', $stream->writes));
        self::assertSame(1, $stream->ends);
    }

    /** 空role帧不构成语义输出，明确的临时上游错误可标记重试。 */
    public function testEmptyRoleFrameDoesNotBecomePartialOutput(): void
    {
        $stream = $this->runStream('', new LLMApiException('mock unavailable', statusCode: 503));
        $payload = json_decode(substr($stream->writes[1], 6), true);
        self::assertFalse($payload['error']['partial']);
        self::assertTrue($payload['error']['retryable']);
    }

    /** 半截工具参数保留流索引，异常不能伪装成功或允许重放工具。 */
    public function testPartialToolArgumentsKeepIndexAndDisableRetry(): void
    {
        $stream = new RecordingStream();
        Context::set('LLMAssembler::EventStream', $stream);
        $choice = ChatCompletionChoice::fromArray([
            'index' => 0,
            'delta' => ['role' => 'assistant', 'tool_calls' => [[
                'index' => 3, 'id' => 'mock-call', 'type' => 'function',
                'function' => ['name' => 'mock_write', 'arguments' => '{"text":'],
            ]]],
        ]);
        LLMAssembler::createStreamResponseByChatCompletionResponse(new CompletionDTO(), $this->response([$choice], new LLMApiException('mock unavailable', statusCode: 503)));
        $chunk = json_decode(substr($stream->writes[0], 6), true);
        $error = json_decode(substr($stream->writes[1], 6), true)['error'];
        self::assertSame(3, $chunk['choices'][0]['delta']['tool_calls'][0]['index']);
        self::assertTrue($error['partial']);
        self::assertFalse($error['retryable']);
        self::assertStringNotContainsString('[DONE]', implode('', $stream->writes));
        self::assertSame(1, $stream->ends);
    }

    /** 尚未开始响应的异常必须保持原HTTP异常语义。 */
    public function testFailureBeforeStartIsRethrownWithoutCreatingStream(): void
    {
        Context::destroy('LLMAssembler::EventStream');
        $error = new RuntimeException('mock preflight');
        $response = $this->response([], $error);
        try {
            LLMAssembler::createStreamResponseByChatCompletionResponse(new CompletionDTO(), $response);
            self::fail('应重新抛出未启动响应的异常');
        } catch (RuntimeException $caught) {
            self::assertSame($error, $caught);
            self::assertFalse(Context::has('LLMAssembler::EventStream'));
        }
    }

    /** 错误帧写入失败仍应执行连接结束。 */
    public function testErrorWriteFailureStillEndsStream(): void
    {
        $stream = new RecordingStream();
        $stream->failAtWrite = 2;
        $this->runStream('mock text', new RuntimeException('mock error'), $stream);
        self::assertSame(1, $stream->ends);
        self::assertSame(1, $stream->closes);
    }

    /** 消费端断开和清理异常不能阻止其他清理操作。 */
    public function testDisconnectedClientAndEndFailureStillClose(): void
    {
        $stream = new RecordingStream();
        $stream->failAtWrite = 1;
        $stream->failEnd = true;
        $this->runStream('mock text', null, $stream);
        self::assertSame(1, $stream->ends);
        self::assertSame(1, $stream->closes);
    }

    /** 在已开始的内存流中消费真实组装方法。 */
    private function runStream(string $text, ?Throwable $error, ?RecordingStream $stream = null): RecordingStream
    {
        $stream ??= new RecordingStream();
        Context::set('LLMAssembler::EventStream', $stream);
        $choice = ChatCompletionChoice::fromArray(['index' => 0, 'delta' => ['role' => 'assistant', 'content' => $text], 'finish_reason' => $error ? null : 'stop']);
        LLMAssembler::createStreamResponseByChatCompletionResponse(new CompletionDTO(['model' => 'mock-model']), $this->response([$choice], $error));
        return $stream;
    }

    /** 用Generator替身控制数据帧和异常，不访问真实Provider。 */
    private function response(array $choices, ?Throwable $error): ChatCompletionStreamResponse
    {
        $response = $this->createMock(ChatCompletionStreamResponse::class);
        $response->method('getStreamIterator')->willReturnCallback(static function () use ($choices, $error) {
            foreach ($choices as $choice) {
                yield $choice;
            }
            if ($error) {
                throw $error;
            }
        });
        return $response;
    }
}

/** 仅记录真实组装器的写入及收尾调用，不创建网络连接。 */
class RecordingStream extends EventStream
{
    public array $writes = [];

    public int $ends = 0;

    public int $closes = 0;

    public ?int $failAtWrite = null;

    public bool $failEnd = false;

    private int $attempts = 0;

    /** 跳过真实响应头和socket构造。 */
    public function __construct()
    {
    }

    /** 记录合成帧或模拟断开。 */
    public function write(string $data): self
    {
        if (++$this->attempts === $this->failAtWrite) {
            throw new RuntimeException('mock disconnected');
        }
        $this->writes[] = $data;
        return $this;
    }

    /** 模拟响应结束及结束失败。 */
    public function end(): void
    {
        ++$this->ends;
        if ($this->failEnd) {
            throw new RuntimeException('mock end failure');
        }
    }

    /** 记录关闭入口。 */
    public function close(): void
    {
        ++$this->closes;
    }
}
