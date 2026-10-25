<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

/**
 * 视频模式标识。
 *
 * 所有取值都可作为标准请求里的 input_mode；其中只有 VideoEdit 需要配套的 task=edit
 * 才能通过领域层校验（见 VideoTaskType::supportsInputMode）。样片成片走的是
 * task=generate：draft_task 是输入形态而不是任务类型，不在 VideoTaskType 里建值。
 */
enum VideoInputMode: string
{
    // 普通文生视频，不依赖任何参考素材。
    case Standard = 'standard';

    // 参考图模式，仅通过 reference_images 传入图片素材。
    case ImageReference = 'image_reference';

    // 全能参考模式，混合使用图片、视频、音频等参考素材。
    case OmniReference = 'omni_reference';

    // 视频编辑模式，当前主要用于前端展示模式和能力配置。
    case VideoEdit = 'video_edit';

    // 首尾帧模式，通过 frames 传入起止画面引导生成。
    case KeyframeGuided = 'keyframe_guided';

    // 样片成片模式，通过 draft_task 传入已生成的样片任务引用，出正式分辨率的成片。
    case DraftTask = 'draft_task';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(
            static fn (self $inputMode): string => $inputMode->value,
            self::cases(),
        );
    }

    public static function isValid(string $value): bool
    {
        return self::tryFrom($value) instanceof self;
    }

    /**
     * @return list<string>
     */
    public static function requestValues(): array
    {
        return [
            self::Standard->value,
            self::VideoEdit->value,
            self::ImageReference->value,
            self::OmniReference->value,
            self::KeyframeGuided->value,
            self::DraftTask->value,
        ];
    }

    public static function isRequestValid(string $value): bool
    {
        return in_array($value, self::requestValues(), true);
    }
}
