<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\File;

/**
 * 统一识别 provider 专用素材 URI，避免各层重复实现协议校验。
 */
final class ProviderAssetUri
{
    /**
     * 判断 URI 是否为受控的 asset:// 素材引用。
     */
    public static function isValid(string $uri): bool
    {
        return preg_match('/^asset:\/\/[A-Za-z0-9][A-Za-z0-9._-]*$/', trim($uri)) === 1;
    }

    /**
     * 判断 URI 是否引用本地资产主键。
     *
     * 火山素材 ID 以 asset- 开头，本地资产 ID 使用数据库数字主键；两者都沿用
     * asset:// 协议，但解析阶段必须区分，否则本地资产会被错误地直接透传给火山。
     */
    public static function isLocalAsset(string $uri): bool
    {
        return preg_match('/^asset:\/\/\d+$/', trim($uri)) === 1;
    }

    public static function getLocalAssetId(string $uri): ?int
    {
        if (! self::isLocalAsset($uri)) {
            return null;
        }
        return (int) substr(trim($uri), strlen('asset://'));
    }
}
