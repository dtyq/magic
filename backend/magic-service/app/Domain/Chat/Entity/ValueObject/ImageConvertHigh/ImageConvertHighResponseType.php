<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject\ImageConvertHigh;

enum ImageConvertHighResponseType: int
{
    // 开始生成
    case START_GENERATE = 1;

    // 生成完成
    case GENERATED = 2;

    // 异常终止
    case TERMINATE = 3;

    public static function getNameFromType(ImageConvertHighResponseType $type): string
    {
        return match ($type) {
            self::START_GENERATE => '开始生成',
            self::GENERATED => '生成完成',
            self::TERMINATE => '异常终止',
            default => '未知类型',
        };
    }
}
