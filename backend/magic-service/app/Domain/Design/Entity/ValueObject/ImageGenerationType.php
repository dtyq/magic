<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity\ValueObject;

/**
 * 图片生成类型枚举.
 */
enum ImageGenerationType: int
{
    case None = 0;

    /**
     * 文生图.
     */
    case TEXT_TO_IMAGE = 1;

    /**
     * 图生图.
     */
    case IMAGE_TO_IMAGE = 2;

    /**
     * 转高清.
     */
    case UPSCALE = 3;

    /**
     * 去背景.
     */
    case REMOVE_BACKGROUND = 4;

    /**
     * 橡皮擦（原图 + 标记图，擦除标记区域）.
     */
    case ERASER = 5;

    /**
     * 获取所有类型值
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function make(null|int|string $type): self
    {
        if (is_string($type)) {
            $type = (int) $type;
        }
        if (is_null($type)) {
            return self::None;
        }
        return self::tryFrom($type) ?? self::None;
    }
}
