<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

enum ModelType: int
{
    case TEXT_TO_IMAGE = 0; // 文生图
    case IMAGE_TO_IMAGE = 1; // 图生图
    case IMAGE_ENHANCE = 2; // 图片增强
    case LLM = 3; // 大模型
    case EMBEDDING = 4; // 嵌入

    public function label(): string
    {
        return match ($this) {
            self::TEXT_TO_IMAGE => '文生图',
            self::IMAGE_TO_IMAGE => '图生图',
            self::IMAGE_ENHANCE => '图片增强',
            self::LLM => '大模型',
            self::EMBEDDING => '嵌入',
        };
    }

    public function isLLM(): bool
    {
        return $this === self::LLM;
    }

    public function isEmbedding(): bool
    {
        return $this === self::EMBEDDING;
    }

    public function isVLM(): bool
    {
        return $this === self::TEXT_TO_IMAGE || $this === self::IMAGE_TO_IMAGE;
    }
}
