<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

/**
 * 视频模式标识。
 *
 * 其中 Standard / ImageReference / OmniReference / KeyframeGuided
 * 是标准请求里的 input_mode；
 * VideoEdit 目前主要用于前端展示模式和能力配置，不作为标准 input_mode 直接透传。
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
        ];
    }

    public static function isRequestValid(string $value): bool
    {
        return in_array($value, self::requestValues(), true);
    }
}
