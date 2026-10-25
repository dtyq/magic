<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\OpenApi;

use App\Application\MCP\Authorization\MCPAuthorizationAppService;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Agent\Facade\Sandbox\AbstractSuperMagicSandboxApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\AuthManager;

/**
 * Super Magic 获取 MCP Authorization 运行时凭据接口。
 */
#[ApiResponse(version: 'low_code')]
class MCPAuthorizationCredentialApi extends AbstractSuperMagicSandboxApi
{
    public function __construct(
        AuthManager $authManager,
        RequestInterface $request,
        private readonly MCPAuthorizationAppService $authorizationAppService,
    ) {
        parent::__construct($authManager, $request);
    }

    /**
     * 按 MCP Server code 获取当前用户的最新运行时 access token。
     */
    public function getCredential(string $code): array
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $dataIsolation = MCPDataIsolation::create(
            (string) $authorization->getOrganizationCode(),
            (string) $authorization->getId()
        );

        return $this->authorizationAppService->getRuntimeCredential($dataIsolation, $code);
    }
}
