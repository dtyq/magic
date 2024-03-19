<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject\AIImage;

enum AIImageCardResponseType: int
{
    // 开始生成
    case START_GENERATE = 1;

    // 生成完成
    case GENERATED = 2;

    // 引用图片
    case REFERENCE_IMAGE = 3;

    // 异常终止
    case TERMINATE = 4;

    public static function getNameFromType(AIImageCardResponseType $type): string
    {
        return match ($type) {
            self::START_GENERATE => '开始生成',
            self::GENERATED => '生成完成',
            self::REFERENCE_IMAGE => '引用图片',
            default => '未知类型',
        };
    }
}
