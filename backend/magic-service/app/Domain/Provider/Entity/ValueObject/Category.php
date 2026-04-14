<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

enum Category: string
{
    case LLM = 'llm';
    case VLM = 'vlm';

    /** Video Generation Model. */
    case VGM = 'vgm';

    public function label(): string
    {
        return match ($this) {
            self::LLM => '文本模型',
            self::VLM => '图片生成',
            self::VGM => '视频模型',
        };
    }
}
