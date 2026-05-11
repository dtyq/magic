<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\Facade\Admin;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Skill\Service\AdminSkillAppService;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillVersionsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class OrganizationAdminSkillApi extends AbstractApi
{
    #[Inject]
    protected AdminSkillAppService $adminSkillAppService;

    #[CheckPermission(MagicResourceEnum::WORKSPACE_ADMIN_AI_SKILL, MagicOperationEnum::QUERY)]
    public function queryVersions(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = QuerySkillVersionsRequestAdminDTO::fromRequest($this->request);

        return $this->adminSkillAppService->queryOrganizationVersions($requestContext, $requestDTO)->toArray();
    }

    #[CheckPermission(MagicResourceEnum::WORKSPACE_ADMIN_AI_SKILL, MagicOperationEnum::EDIT)]
    public function approveVersion(RequestContext $requestContext, int $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $this->adminSkillAppService->approveOrganizationVersion($requestContext, $id);

        return [];
    }

    #[CheckPermission(MagicResourceEnum::WORKSPACE_ADMIN_AI_SKILL, MagicOperationEnum::EDIT)]
    public function rejectVersion(RequestContext $requestContext, int $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $this->adminSkillAppService->rejectOrganizationVersion($requestContext, $id);

        return [];
    }
}
