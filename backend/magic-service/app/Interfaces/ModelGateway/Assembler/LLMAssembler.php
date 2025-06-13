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
    public static function createResponseByChatCompletionResponse(ChatCompletionResponse $chatCompletionResponse): array
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
            'choices' => $choices,
            'usage' => $usage,
        ];
    }

    public static function createStreamResponseByChatCompletionResponse(CompletionDTO $sendMsgLLMDTO, ChatCompletionStreamResponse $chatCompletionStreamResponse): void
    {
        self::getEventStream()->write('data:' . json_encode([
            'choices' => [],
            'created' => 0,
            'id' => '',
            'model' => '',
            'object' => '',
            'prompt_filter_results' => [],
        ], JSON_UNESCAPED_UNICODE) . "\n\n");

        /** @var ChatCompletionChoice $choice */
        foreach ($chatCompletionStreamResponse->getStreamIterator() as $choice) {
            $message = $choice->getMessage();
            if ($message instanceof AssistantMessage && $message->hasToolCalls()) {
                $delta = $message->toArrayWithStream();
            } else {
                $delta = $message->toArray();
            }
            $data = [
                'choices' => [
                    'content_filter_results' => [],
                    'finish_reason' => $choice->getFinishReason(),
                    'index' => $choice->getIndex(),
                    'logprobs' => $choice->getLogprobs(),
                    'delta' => $delta,
                ],
                'created' => $chatCompletionStreamResponse->getCreated(),
                'id' => $chatCompletionStreamResponse->getId(),
                'model' => $sendMsgLLMDTO->getModel(),
                'object' => $chatCompletionStreamResponse->getObject(),
            ];
            self::getEventStream()->write('data:' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n");
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
