<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\Facade\Agent;

use App\Application\Admin\Agent\Service\AdminAgentAppService;
use App\Application\Chat\Service\MagicAccountAppService;
use App\Application\Chat\Service\MagicUserContactAppService;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Admin\Entity\ValueObject\AgentFilterType;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Auth\PermissionChecker;
use App\Interfaces\Admin\DTO\Request\QueryPageAgentDTO;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\AuthManager;

#[ApiResponse('low_code')]
class AdminAgentApi extends AbstractApi
{
    public function __construct(
        protected AdminAgentAppService $adminAgentAppService,
        protected OperationPermissionAppService $permissionAppService,
        RequestInterface $request,
        AuthManager $authManager,
    ) {
        parent::__construct(
            $authManager,
            $request,
        );
    }

    public function getPublishedAgents()
    {
        $this->isInWhiteListForOrgization();
        $pageToken = $this->request->input('page_token', '');
        $pageSize = (int) $this->request->input('page_size', 20);
        $type = AgentFilterType::from((int) $this->request->input('type', AgentFilterType::ALL->value));

        return $this->adminAgentAppService->getPublishedAgents(
            $this->getAuthorization(),
            $pageToken,
            $pageSize,
            $type
        );
    }

    public function queriesAgents(RequestInterface $request)
    {
        $this->isInWhiteListForOrgization();
        /**
         * @var MagicUserAuthorization $authenticatable
         */
        $authenticatable = $this->getAuthorization();
        $queryPageAgentDTO = new QueryPageAgentDTO($request->all());
        return $this->adminAgentAppService->queriesAgents($authenticatable, $queryPageAgentDTO);
    }

    public function getAgentDetail(RequestInterface $request, string $agentId)
    {
        $this->isInWhiteListForOrgization();
        /**
         * @var MagicUserAuthorization $authenticatable
         */
        $authenticatable = $this->getAuthorization();
        return $this->adminAgentAppService->getAgentDetail($authenticatable, $agentId);
    }

    public function getOrganizationAgentsCreators(RequestInterface $request)
    {
        $this->isInWhiteListForOrgization();
        /**
         * @var MagicUserAuthorization $authenticatable
         */
        $authenticatable = $this->getAuthorization();
        return $this->adminAgentAppService->getOrganizationAgentsCreators($authenticatable);
    }

    public function deleteAgent(RequestInterface $request, string $agentId)
    {
        $this->isInWhiteListForOrgization();
        /**
         * @var MagicUserAuthorization $authenticatable
         */
        $authenticatable = $this->getAuthorization();
        $this->adminAgentAppService->deleteAgent($authenticatable, $agentId);
    }

    private function getPhone(string $userId)
    {
        $magicUserContactAppService = di(MagicUserContactAppService::class);
        $user = $magicUserContactAppService->getByUserId($userId);
        $magicAccountAppService = di(MagicAccountAppService::class);
        $accountEntity = $magicAccountAppService->getAccountInfoByMagicId($user->getMagicId());
        return $accountEntity->getPhone();
    }

    private function isInWhiteListForOrgization(): void
    {
        /**
         * @var MagicUserAuthorization $authentication
         */
        $authentication = $this->getAuthorization();
        $phone = $this->getPhone($authentication->getId());
        if (! PermissionChecker::isOrganizationAdmin($authentication->getOrganizationCode(), $phone)) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE);
        }
    }
}
