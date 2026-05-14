<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\DTO;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Throwable;

readonly class ApiKeyAuthResult
{
    /**
     * @param null|AccessTokenEntity $accessTokenEntity 历史 AccessToken 鉴权成功时返回实体
     * @param null|MagicUserAuthorization $userAuthorization 用户上下文（ModelGatewayUser/User/AccessToken(User) 均可能生成）
     * @param null|string $apiKey 实际命中的 api-key 明文（仅 AccessToken 路径需要回写）
     * @param null|Throwable $authException 鉴权异常（目前保留扩展位）
     * @param string $authSource 命中的来源：user-authorization / api-key
     * @param string $authTokenType 命中的 token 类型：ModelGatewayUser / User / AccessToken:user...
     */
    public function __construct(
        public ?AccessTokenEntity $accessTokenEntity,
        public ?MagicUserAuthorization $userAuthorization,
        public ?string $apiKey,
        public ?Throwable $authException = null,
        public string $authSource = '',
        public string $authTokenType = ''
    ) {
    }
}
