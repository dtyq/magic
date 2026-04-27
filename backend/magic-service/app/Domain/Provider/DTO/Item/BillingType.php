<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

enum BillingType: string
{
    case Tokens = 'Tokens'; // token 计价
    case Times = 'Times'; // 次数计价
    case Per_Second = 'Per_Second'; // 按秒计价
    case TextTokens = 'TextTokens'; // 文本模型 token 计费
    case ImageCount = 'ImageCount'; // 图片按张计费
    case ImageTokens = 'ImageTokens'; // 图片 token 计费
    case VideoDuration = 'VideoDuration'; // 视频按时长计费
    case VideoTokens = 'VideoTokens'; // 视频 token 计费

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

    public function isTextToken(): bool
    {
        return in_array($this, [self::Tokens, self::TextTokens], true);
    }

    public function isImageCount(): bool
    {
        return in_array($this, [self::ImageCount, self::Times], true);
    }

    public function isImageToken(): bool
    {
        return $this === self::ImageTokens;
    }

    public function isVideoDuration(): bool
    {
        return in_array($this, [self::VideoDuration, self::Per_Second, self::Per_Hour], true);
    }

    public function isVideoToken(): bool
    {
        return $this === self::VideoTokens;
    }
}
