<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

enum NaturalLanguageProcessing: string
{
    case DEFAULT = 'default';
    case EMBEDDING = 'embedding'; // 嵌入
    case LLM = 'llm'; // 大语言
    case VLM = 'vlm'; // 生图
    case VIDEO = 'video'; // 视频生成

    /**
     * 根据服务商分类和模型类型映射到对应的连通性测试类型。
     */
    public static function fromCategory(Category $category, ?int $modelType = null): self
    {
        // 同一服务商分类下按 model_type 区分 LLM 与 embedding，视频分类统一走 VIDEO。
        return match ($category) {
            Category::LLM => $modelType === ModelType::EMBEDDING->value ? self::EMBEDDING : self::LLM,
            Category::VLM => self::VLM,
            Category::VGM, Category::VIDEO => self::VIDEO,
            default => self::DEFAULT,
        };
    }
}
