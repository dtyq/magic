<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Model;

use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Api\Response\TextCompletionResponse;
use Hyperf\Odin\Contract\Api\ClientInterface;
use Hyperf\Odin\Model\AbstractModel;
use Hyperf\Odin\Model\Embedding;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;

class ImageGenerationModel extends AbstractModel
{
    public function __construct(string $model, array $config = [], ?LoggerInterface $logger = null)
    {
        parent::__construct($model, $config, $logger);

        // Set model options for image generation model
        $this->modelOptions->setChat(false);
        $this->modelOptions->setFunctionCall(false);
        $this->modelOptions->setEmbedding(false);
        $this->modelOptions->setMultiModal(true);
        $this->modelOptions->setVectorSize(0);
    }

    public function chat(array $messages, float $temperature = 0.9, int $maxTokens = 0, array $stop = [], array $tools = [], float $frequencyPenalty = 0.0, float $presencePenalty = 0.0, array $businessParams = []): ChatCompletionResponse
    {
        throw new InvalidArgumentException('Image generation models do not support chat functionality');
    }

    public function chatStream(array $messages, float $temperature = 0.9, int $maxTokens = 0, array $stop = [], array $tools = [], float $frequencyPenalty = 0.0, float $presencePenalty = 0.0, array $businessParams = []): ChatCompletionStreamResponse
    {
        throw new InvalidArgumentException('Image generation models do not support chat stream functionality');
    }

    public function completions(string $prompt, float $temperature = 0.9, int $maxTokens = 16, array $stop = [], float $frequencyPenalty = 0.0, float $presencePenalty = 0.0, array $businessParams = []): TextCompletionResponse
    {
        throw new InvalidArgumentException('Image generation models do not support completions functionality');
    }

    public function embeddings(array|string $input, ?string $encoding_format = 'float', ?string $user = null, array $businessParams = []): EmbeddingResponse
    {
        throw new InvalidArgumentException('Image generation models do not support embeddings functionality');
    }

    public function embedding(array|string $input, ?string $encoding_format = 'float', ?string $user = null): Embedding
    {
        throw new InvalidArgumentException('Image generation models do not support embedding functionality');
    }

    protected function getClient(): ClientInterface
    {
        throw new InvalidArgumentException('Image generation models do not require a client implementation');
    }
}
