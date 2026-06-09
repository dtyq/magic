<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response;

use Hyperf\Odin\Api\Response\Usage;

class ImageUsage extends Usage
{
    /**
     * @param int $promptTokens 提示词的令牌数量
     * @param int $completionTokens 图片生成输出的令牌数量
     * @param int $totalTokens 使用的总令牌数量
     * @param int $generatedImages 生成的图片数量
     * @param array $completionTokensDetails 完成令牌的详细信息
     * @param array $promptTokensDetails 提示令牌的详细信息
     * @param int $thoughtsTokens 思考过程的令牌数量
     */
    public function __construct(
        public int $promptTokens = 0,
        public int $completionTokens = 0,
        public int $totalTokens = 0,
        public int $generatedImages = 0,
        public array $completionTokensDetails = [],
        public array $promptTokensDetails = [],
        public int $thoughtsTokens = 0
    ) {
        parent::__construct(
            $this->promptTokens,
            $this->completionTokens,
            $this->totalTokens,
            $this->completionTokensDetails,
            $this->promptTokensDetails
        );
    }

    public static function fromArray(array $usage): self
    {
        return new self(
            $usage['prompt_tokens'] ?? 0,
            $usage['completion_tokens'] ?? 0,
            $usage['total_tokens'] ?? 0,
            $usage['generated_images'] ?? 0,
            $usage['completion_tokens_details'] ?? [],
            $usage['prompt_tokens_details'] ?? [],
            $usage['thoughts_tokens'] ?? 0
        );
    }

    public function getGeneratedImages(): int
    {
        return $this->generatedImages;
    }

    public function setGeneratedImages(int $generatedImages): self
    {
        $this->generatedImages = $generatedImages;
        return $this;
    }

    public function addGeneratedImages(int $count): self
    {
        $this->generatedImages += $count;
        return $this;
    }

    public function getThoughtsTokens(): int
    {
        return $this->thoughtsTokens;
    }

    public function setThoughtsTokens(int $thoughtsTokens): self
    {
        $this->thoughtsTokens = $thoughtsTokens;
        return $this;
    }

    public function addThoughtsTokens(int $count): self
    {
        $this->thoughtsTokens += $count;
        return $this;
    }

    public function addTokenUsage(
        int $promptTokens = 0,
        int $completionTokens = 0,
        int $thoughtsTokens = 0,
        int $totalTokens = 0,
    ): self {
        if ($totalTokens <= 0) {
            $totalTokens = $promptTokens + $completionTokens + $thoughtsTokens;
        }

        $this->promptTokens += $promptTokens;
        $this->completionTokens += $completionTokens;
        $this->thoughtsTokens += $thoughtsTokens;
        $this->totalTokens += $totalTokens;

        return $this;
    }

    public function toArray(): array
    {
        $data = parent::toArray();
        $data['generated_images'] = $this->generatedImages;
        $data['thoughts_tokens'] = $this->thoughtsTokens;
        return $data;
    }
}
