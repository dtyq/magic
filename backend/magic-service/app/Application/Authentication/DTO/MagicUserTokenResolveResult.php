<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\DTO;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;

/**
 * 用户令牌解析结果：
 * - authorization: 可直接写入上下文的用户鉴权对象
 * - tokenType: 命中的 magic token 类型名（ModelGatewayUser/User）
 * - userId: 解析出的用户 ID（用于审计）.
 */
readonly class MagicUserTokenResolveResult
{
    public function __construct(
        public MagicUserAuthorization $authorization,
        public string $tokenType,
        public string $userId
    ) {
    }
}
