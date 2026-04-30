<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

/**
 * 视频任务类型。
 */
enum VideoTaskType: string
{
    // 普通生成：文生、图生、参考素材生成等默认任务。
    case Generate = 'generate';

    // 视频延长：基于已有视频继续生成后续片段。
    case Extend = 'extend';

    // 视频编辑：以已有视频为输入做改写或重生成。
    case Edit = 'edit';

    // 视频超清：对已有视频做清晰度增强。
    case Upscale = 'upscale';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(
            static fn (self $taskType): string => $taskType->value,
            self::cases(),
        );
    }

    public static function isValid(string $value): bool
    {
        return self::tryFrom($value) instanceof self;
    }
}
