<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Model;

use Hyperf\Odin\Api\RequestOptions\ApiOptions;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\TextCompletionResponse;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Model\ModelOptions;
use InvalidArgumentException;

class ImageGenerationModel implements ModelInterface
{
    private string $modelName;
    private ModelOptions $modelOptions;
    private ApiOptions $apiRequestOptions;

    public function __construct(string $modelName, ?ModelOptions $modelOptions = null, ?ApiOptions $apiRequestOptions = null)
    {
        $this->modelName = $modelName;
        $this->modelOptions = $modelOptions ?? new ModelOptions([
            'chat' => false,
            'function_call' => false,
            'embedding' => false,
            'multi_modal' => false,
            'vector_size' => 0,
        ]);
        $this->apiRequestOptions = $apiRequestOptions ?? new ApiOptions([]);
    }

    public function getModelName(): string
    {
        return $this->modelName;
    }

    public function getModelOptions(): ModelOptions
    {
        return $this->modelOptions;
    }

    public function getApiRequestOptions(): ApiOptions
    {
        return $this->apiRequestOptions;
    }


    public function chat(array $messages, float $temperature = 0.9, int $maxTokens = 0, array $stop = [], array $tools = [], float $frequencyPenalty = 0.0, float $presencePenalty = 0.0, array $businessParams = [],): ChatCompletionResponse
    {
        throw new InvalidArgumentException('Image generation models do not support chat functionality');
    }

    public function chatStream(array $messages, float $temperature = 0.9, int $maxTokens = 0, array $stop = [], array $tools = [], float $frequencyPenalty = 0.0, float $presencePenalty = 0.0, array $businessParams = [],): ChatCompletionStreamResponse
    {
        throw new InvalidArgumentException('Image generation models do not support chat stream functionality');
    }

    public function completions(string $prompt, float $temperature = 0.9, int $maxTokens = 0, array $stop = [], float $frequencyPenalty = 0.0, float $presencePenalty = 0.0, array $businessParams = [],): TextCompletionResponse
    {
        throw new InvalidArgumentException('Image generation models do not support completions functionality');
    }
}