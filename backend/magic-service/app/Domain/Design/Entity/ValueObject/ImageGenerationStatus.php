<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity\ValueObject;

/**
 * 图片生成任务状态枚举.
 */
enum ImageGenerationStatus: string
{
    /**
     * 待处理.
     */
    case PENDING = 'pending';

    /**
     * 处理中.
     */
    case PROCESSING = 'processing';

    /**
     * 已完成.
     */
    case COMPLETED = 'completed';

    /**
     * 失败.
     */
    case FAILED = 'failed';

    /**
     * 获取所有状态值
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * 判断状态是否为终态
     */
    public function isFinalState(): bool
    {
        return $this === self::COMPLETED || $this === self::FAILED;
    }
}
