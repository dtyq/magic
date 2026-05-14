<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Entity\ValueObject;

/**
 * token类型:0:账号,1:用户,2:组织,3:应用,4:流程.
 */
enum MagicTokenType: int
{
    // 用户(组织下的一个用户),type_relation_value为用户id
    case User = 0;

    // 账号,type_relation_value为账号id
    case Account = 1;

    // 组织,type_relation_value为组织id
    case Organization = 2;

    // 应用,type_relation_value为应用id
    case App = 3;

    // 流程,type_relation_value为流程id
    case Flow = 4;

    // 天书开放平台
    case TeamshareOpenPlatform = 5;

    // 个人访问令牌,type_relation_value为用户id
    case PersonalAccessToken = 6;

    // 沙箱短效 token，type_relation_value为沙箱id
    case Sandbox = 7;

    // 通用 refresh token（type_relation_value 根据业务场景绑定：如 user_id 等）
    case RefreshToken = 8;

    // 模型网关用户 token，type_relation_value为用户id，必须搭配 RefreshToken 使用
    case ModelGatewayUser = 9;

    /**
     * 通过枚举值名称的字符串获取枚举值.
     */
    public static function getCaseFromName(string $typeName): ?self
    {
        return array_find(self::cases(), fn ($userType) => $userType->name === $typeName);
    }
}
