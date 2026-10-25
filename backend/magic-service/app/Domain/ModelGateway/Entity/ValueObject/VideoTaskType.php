<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

/**
 * 视频任务类型。
 *
 * 只表达业务意图，不区分输入形态；样片成片（draft_task）是输入形态，
 * 由 input_mode 单独表达，不在这里建值，见 VideoInputMode。
 */
enum VideoTaskType: string
{
    // 普通生成：文生、图生、参考素材生成等默认任务；样片成片也归到这里。
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

    public function supportsInputMode(string $inputMode): bool
    {
        return match ($this) {
            self::Edit => $inputMode === VideoInputMode::VideoEdit->value,
            // 样片成片走普通生成意图 + input_mode=draft_task，因此这里不再排除该模式。
            self::Generate => $inputMode !== VideoInputMode::VideoEdit->value,
            self::Extend, self::Upscale => $inputMode === VideoInputMode::Standard->value,
        };
    }

    public function requiredSupportedInput(): ?string
    {
        return match ($this) {
            self::Edit => 'video_edit',
            self::Extend => 'video_extension',
            self::Upscale => 'video_upscale',
            self::Generate => null,
        };
    }

    public function requiresReferenceVideo(): bool
    {
        // 普通生成（含样片成片）的输入是提示词或样片任务 ID，不是参考视频。
        return $this !== self::Generate;
    }
}
