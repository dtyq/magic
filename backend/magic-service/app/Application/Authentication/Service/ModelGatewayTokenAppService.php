<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Domain\Token\DTO\ModelGatewayTokenDTO;
use App\Domain\Token\Service\ModelGatewayTokenDomainService;

/**
 * 模型网关用户 token 应用服务（短效 api_key + refresh_token）.
 */
readonly class ModelGatewayTokenAppService
{
    public function __construct(
        private ModelGatewayTokenDomainService $modelGatewayTokenDomainService
    ) {
    }

    /**
     * 签发 token 对：每次都签发新的 refresh_token 和 api_key。
     */
    public function issueToken(string $userId, array $auditContext = []): ModelGatewayTokenDTO
    {
        return $this->modelGatewayTokenDomainService->issueToken($userId, $auditContext);
    }

    /**
     * refresh：返回新的 api_key，每次都生成新的 refresh_token（双旋转）。
     */
    public function refreshToken(string $refreshToken, array $auditContext = []): ModelGatewayTokenDTO
    {
        return $this->modelGatewayTokenDomainService->refreshToken($refreshToken, $auditContext);
    }
}
