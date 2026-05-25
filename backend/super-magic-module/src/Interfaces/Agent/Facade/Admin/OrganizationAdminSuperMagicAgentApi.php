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
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\ReviewOrganizationAgentVersionRequestDTO;
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
    public function reviewVersion(int $id): array
    {
        $requestDTO = ReviewOrganizationAgentVersionRequestDTO::fromRequest($this->request);
        $this->adminAgentAppService->reviewOrganizationVersion($this->getAuthorization(), $id, $requestDTO);

        return [];
    }
}
