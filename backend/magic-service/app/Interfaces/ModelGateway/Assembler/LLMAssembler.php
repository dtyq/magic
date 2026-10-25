<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Assembler;

use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Infrastructure\Core\Hyperf\EventStream;
use App\Infrastructure\ModelGateway\ModelGatewayEventStream;
use App\Infrastructure\Util\Context\CoContext;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\HttpMessage\Server\Response;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\Response\ChatCompletionChoice;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Exception\LLMException;
use Hyperf\Odin\Exception\LLMException\LLMNetworkException;
use Hyperf\Odin\Message\AssistantMessage;
use Throwable;

/** 组装模型网关响应，并维护流式响应的成功与异常收尾。 */
class LLMAssembler
{
    public static function createResponseByChatCompletionResponse(ChatCompletionResponse $chatCompletionResponse, ?string $modelName = null): array
    {
        $usage = [];
        $chatUsage = $chatCompletionResponse->getUsage();
        if ($chatUsage) {
            $usage = $chatUsage->toArray();
        }
        $choices = [];
        /** @var ChatCompletionChoice $choice */
        foreach ($chatCompletionResponse->getChoices() ?? [] as $choice) {
            $choices[] = [
                'finish_reason' => $choice->getFinishReason(),
                'index' => $choice->getIndex(),
                'logprobs' => $choice->getLogprobs(),
                'message' => $choice->getMessage()->toArray(),
            ];
        }
        return [
            'id' => $chatCompletionResponse->getId(),
            'object' => $chatCompletionResponse->getObject(),
            'created' => $chatCompletionResponse->getCreated(),
            'model' => $modelName ?? $chatCompletionResponse->getModel(),
            'choices' => $choices,
            'usage' => $usage,
        ];
    }

    /** 消费同一个上游流；下游断连由专用输出对象隔离，上游异常以SSE错误收尾。 */
    public static function createStreamResponseByChatCompletionResponse(CompletionDTO $sendMsgLLMDTO, ChatCompletionStreamResponse $chatCompletionStreamResponse): void
    {
        $startedStream = Context::get('LLMAssembler::EventStream');
        $stream = $startedStream instanceof EventStream ? $startedStream : null;
        $partial = false;
        try {
            /** @var ChatCompletionChoice $choice */
            foreach ($chatCompletionStreamResponse->getStreamIterator() as $choice) {
                $message = $choice->getMessage();
                if ($message instanceof AssistantMessage && $message->hasToolCalls()) {
                    $delta = $message->toArrayWithStream();
                    // 补全 tool_calls index：优先使用 stream_index（来自上游 provider），无则用数组位置兜底
                    if (isset($delta['tool_calls']) && is_array($delta['tool_calls'])) {
                        foreach ($delta['tool_calls'] as $arrIdx => &$toolCall) {
                            if (! isset($toolCall['index'])) {
                                $toolCall['index'] = $arrIdx;
                            }
                        }
                        unset($toolCall);
                    }
                } else {
                    $delta = $message->toArray();
                }
                $partial = $partial || self::hasSemanticOutput($delta);
                $data = [
                    'choices' => [
                        [
                            'finish_reason' => $choice->getFinishReason(),
                            'index' => $choice->getIndex(),
                            'logprobs' => $choice->getLogprobs(),
                            'delta' => $delta,
                        ],
                    ],
                    'created' => $chatCompletionStreamResponse->getCreated(),
                    'id' => $chatCompletionStreamResponse->getId(),
                    'model' => $sendMsgLLMDTO->getModel(),
                    'object' => $chatCompletionStreamResponse->getObject(),
                    'usage' => null, // usage is null in all chunks except the last one when include_usage is true
                ];
                ($stream ??= self::getEventStream())->write('data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n");
            }

            // Send usage information as the last chunk if requested
            if ($sendMsgLLMDTO->shouldIncludeUsageInStream() && $chatCompletionStreamResponse->getUsage()) {
                $usage = $chatCompletionStreamResponse->getUsage()->toArray();

                $usageData = [
                    'choices' => [], // Empty choices array for usage chunk
                    'created' => $chatCompletionStreamResponse->getCreated(),
                    'id' => $chatCompletionStreamResponse->getId(),
                    'model' => $sendMsgLLMDTO->getModel(),
                    'object' => $chatCompletionStreamResponse->getObject(),
                    'usage' => $usage,
                ];
                ($stream ??= self::getEventStream())->write('data: ' . json_encode($usageData, JSON_UNESCAPED_UNICODE) . "\n\n");
            }
            ($stream ??= self::getEventStream())->write('data: [DONE]' . "\n\n");
        } catch (Throwable $error) {
            // 首帧前尚未提交响应头，仍交给原有HTTP异常处理，不强行创建200响应。
            if ($stream === null) {
                throw $error;
            }
            self::logStreamFailure($error, 'iterate', $partial);
            try {
                $stream->write('data: ' . json_encode(self::buildStreamError($error, $partial), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n\n");
            } catch (Throwable $writeError) {
                self::logStreamFailure($writeError, 'write_error', $partial);
            }
        } finally {
            if ($stream !== null) {
                self::finishStream($stream, $partial);
            }
        }
    }

    public static function createEmbeddingsResponse(EmbeddingResponse $embeddingResponse): array
    {
        return $embeddingResponse->toArray();
    }

    /**
     * @param array<ModelConfigEntity> $modelEntities
     */
    public static function createModels(array $modelEntities, bool $withInfo = false): array
    {
        $list = [];
        foreach ($modelEntities as $modelEntity) {
            $data = [
                'id' => $modelEntity->getType(),
                'object' => $modelEntity->getObject(),
                'created_at' => $modelEntity->getCreatedAt()->getTimestamp(),
                'owner_by' => $modelEntity->getOwnerBy() ?: 'magic',
            ];
            if ($withInfo) {
                $data['info'] = $modelEntity->getInfo();
            }
            $list[] = $data;
        }
        return [
            'object' => 'list',
            'data' => $list,
        ];
    }

    /** 空角色帧不算语义输出；文本、推理或工具参数片段均按部分输出处理。 */
    private static function hasSemanticOutput(array $delta): bool
    {
        foreach (['content', 'reasoning_content', 'reasoning_details', 'tool_calls'] as $key) {
            $value = $delta[$key] ?? null;
            if ((is_string($value) && $value !== '') || (is_array($value) && $value !== [])) {
                return true;
            }
        }
        return false;
    }

    /** 返回兼容OpenAI的脱敏错误帧，未知错误保守禁止自动重试。 */
    private static function buildStreamError(Throwable $error, bool $partial): array
    {
        $retryable = $error instanceof LLMNetworkException
            || ($error instanceof LLMException && ($error->getStatusCode() === 429 || $error->getStatusCode() >= 500));
        return ['error' => [
            'message' => 'Model response stream interrupted.',
            'type' => 'server_error',
            'code' => $error instanceof LLMException ? 'upstream_stream_error' : 'stream_response_error',
            'param' => null,
            'request_id' => CoContext::getRequestId(),
            'retryable' => ! $partial && $retryable,
            'partial' => $partial,
        ]];
    }

    /** 分别尝试结束响应和释放流，清理失败不能掩盖最初异常。 */
    private static function finishStream(EventStream $stream, bool $partial): void
    {
        try {
            $stream->end();
        } catch (Throwable $error) {
            self::logStreamFailure($error, 'end', $partial);
        }
        try {
            $stream->close();
        } catch (Throwable $error) {
            self::logStreamFailure($error, 'close', $partial);
        }
    }

    /** 只记录安全分类与关联ID，不记录上游异常正文、账号或请求头。 */
    private static function logStreamFailure(Throwable $error, string $phase, bool $partial): void
    {
        try {
            ApplicationContext::getContainer()->get(LoggerFactory::class)->get(self::class)->error('模型流式响应异常', [
                'request_id' => CoContext::getRequestId(),
                'exception_class' => $error::class,
                'phase' => $phase,
                'partial' => $partial,
            ]);
        } catch (Throwable) {
            // 日志故障不得阻止错误帧和连接结束。
        }
    }

    /** 在请求上下文中复用模型专用输出对象。 */
    private static function getEventStream(): EventStream
    {
        $key = 'LLMAssembler::EventStream';
        if (Context::has($key)) {
            return Context::get($key);
        }
        /** @var Response $response */
        $response = di(ResponseInterface::class);
        $eventStream = new ModelGatewayEventStream($response->getConnection(), $response);
        Context::set($key, $eventStream);
        return $eventStream;
    }
}
