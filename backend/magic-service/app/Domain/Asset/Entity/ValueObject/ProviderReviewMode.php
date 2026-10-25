<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject;

/**
 * 素材合规结论的来源。
 */
enum ProviderReviewMode: string
{
    /** 走火山方舟素材注册与合规审核。 */
    case VOLCENGINE = 'VOLCENGINE';

    /** 视觉预检确认无人像，未向火山注册任何素材与素材组。 */
    case NO_PERSON = 'NO_PERSON';

    /** 复用同内容已通过审核的火山素材，未新建远程资源。 */
    case REUSED = 'REUSED';

    /**
     * 宽容解析：历史行或未知取值一律退回 VOLCENGINE，避免新增枚举值让老数据读取直接抛错。
     */
    public static function fromValue(mixed $value): self
    {
        return self::tryFrom(strtoupper(trim((string) $value))) ?? self::VOLCENGINE;
    }
}
