<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\AdminSuperMagicAgentAppService;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentVersionsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\AbstractSuperMagicApi;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class OrganizationAdminSuperMagicAgentApi extends AbstractSuperMagicApi
{
    #[Inject]
    protected AdminSuperMagicAgentAppService $adminAgentAppService;

    #[CheckPermission(MagicResourceEnum::WORKSPACE_ADMIN_AI_AGENT, MagicOperationEnum::QUERY)]
    public function queryVersions(): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = QueryAgentVersionsRequestAdminDTO::fromRequest($this->request);

        return $this->adminAgentAppService->queryOrganizationVersions($authorization, $requestDTO)->toArray();
    }

    #[CheckPermission(MagicResourceEnum::WORKSPACE_ADMIN_AI_AGENT, MagicOperationEnum::EDIT)]
    public function approveVersion(int $id): array
    {
        $this->adminAgentAppService->approveOrganizationVersion($this->getAuthorization(), $id);

        return [];
    }

    #[CheckPermission(MagicResourceEnum::WORKSPACE_ADMIN_AI_AGENT, MagicOperationEnum::EDIT)]
    public function rejectVersion(int $id): array
    {
        $this->adminAgentAppService->rejectOrganizationVersion($this->getAuthorization(), $id);

        return [];
    }
}
