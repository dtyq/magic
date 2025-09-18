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
     * @param int $completionTokens 完成内容的令牌数量
     * @param int $totalTokens 使用的总令牌数量
     * @param int $generatedImages 生成的图片数量
     * @param array $completionTokensDetails 完成令牌的详细信息
     * @param array $promptTokensDetails 提示令牌的详细信息
     */
    public function __construct(
        public int $promptTokens = 0,
        public int $completionTokens = 0,
        public int $totalTokens = 0,
        public int $generatedImages = 0,
        public array $completionTokensDetails = [],
        public array $promptTokensDetails = []
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
            $usage['prompt_tokens_details'] ?? []
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

    public function toArray(): array
    {
        $data = parent::toArray();
        $data['generated_images'] = $this->generatedImages;
        return $data;
    }
}
