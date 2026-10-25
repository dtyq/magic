<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

enum BillingType: string
{
    // ---------------- 通用计费类型 ----------------
    case Tokens = 'Tokens'; // token 计价
    case Times = 'Times'; // 次数计价
    case Per_Second = 'Per_Second'; // 按秒计价

    // ---------------- 文本模型计费类型 ----------------
    case TextTokens = 'TextTokens'; // 文本模型 token 计费

    // ---------------- 生图模型计费类型 ----------------
    case ImageCount = 'ImageCount'; // 图片按张计费
    case ImageTokens = 'ImageTokens'; // 图片 token 计费
    case ImageTokensWithThought = 'ImageTokensWithThought'; // 图片 token 计费：含思考过程
    case Seedream5ProImage = 'Seedream5ProImage'; // VolcengineArk Seedream 5 Pro 图片计费

    // ---------------- 视频模型计费类型 ----------------
    case VideoResolutionDuration = 'VideoResolutionDuration'; // 视频按时长计费：分辨率
    case VideoResolutionAudioDuration = 'VideoResolutionAudioDuration'; // 视频按时长计费：分辨率 + 音频
    case VideoResolutionReferenceVideoDuration = 'VideoResolutionReferenceVideoDuration'; // 视频按时长计费：分辨率 + 参考视频
    case VideoResolutionTokens = 'VideoResolutionTokens'; // 视频 token 计费：分辨率
    case VideoResolutionReferenceVideoTokens = 'VideoResolutionReferenceVideoTokens'; // 视频 token 计费：分辨率 + 参考视频
    case GeminiOmniVideoTokensPricing = 'GeminiOmniVideoTokensPricing'; // Gemini Omni 视频按输入、输出与思考 Token 计费
    case AliyunWanVideoDurationPricing = 'AliyunWanVideoDurationPricing'; // 阿里云 Wan 视频按分辨率和时长计费
    case KelingVideoResolutionMediaConditionDurationPricing = 'KelingVideoResolutionMediaConditionDurationPricing'; // 可灵视频按分辨率、音频与参考视频时长计费
    case VolcengineArkVideoResolutionReferenceVideoTokenMatrix = 'VolcengineArkVideoResolutionReferenceVideoTokenMatrix'; // 火山视频按分辨率与参考视频 token 矩阵计费
    case MiniMaxH3VideoMediaUsagePricing = 'MiniMaxH3VideoMediaUsagePricing'; // MiniMax H3 输出、参考视频与超额参考图片计费

    public function isTokens(): bool
    {
        return in_array($this, [self::Tokens, self::TextTokens], true);
    }

    public function isTimes(): bool
    {
        return $this->value === self::Times->value;
    }

    public function isPerSecond(): bool
    {
        return $this->value === self::Per_Second->value;
    }
}
