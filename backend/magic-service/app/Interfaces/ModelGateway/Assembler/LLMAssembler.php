<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Assembler;

use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use Hyperf\Context\Context;
use Hyperf\Engine\Http\EventStream;
use Hyperf\HttpMessage\Server\Response;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Hyperf\Odin\Api\Response\ChatCompletionChoice;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Message\AssistantMessage;

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

    public static function createStreamResponseByChatCompletionResponse(CompletionDTO $sendMsgLLMDTO, ChatCompletionStreamResponse $chatCompletionStreamResponse): void
    {
        /** @var ChatCompletionChoice $choice */
        foreach ($chatCompletionStreamResponse->getStreamIterator() as $choice) {
            $message = $choice->getMessage();
            if ($message instanceof AssistantMessage && $message->hasToolCalls()) {
                $delta = $message->toArrayWithStream();
                // Fix tool_calls index for streaming
                if (isset($delta['tool_calls']) && is_array($delta['tool_calls'])) {
                    foreach ($delta['tool_calls'] as $index => &$toolCall) {
                        $toolCall['index'] = $index;
                    }
                }
            } else {
                $delta = $message->toArray();
            }
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
            self::getEventStream()->write('data:' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n");
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
            self::getEventStream()->write('data:' . json_encode($usageData, JSON_UNESCAPED_UNICODE) . "\n\n");
        }

        self::getEventStream()->write('data:[DONE]' . "\n\n");
        self::getEventStream()->end();
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

    private static function getEventStream(): EventStream
    {
        $key = 'LLMAssembler::EventStream';
        if (Context::has($key)) {
            return Context::get($key);
        }
        /** @var Response $response */
        $response = di(ResponseInterface::class);
        $eventStream = new EventStream($response->getConnection(), $response);
        Context::set($key, $eventStream);
        return $eventStream;
    }
}
