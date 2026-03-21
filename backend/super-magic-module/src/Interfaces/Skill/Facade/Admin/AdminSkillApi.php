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
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ReviewSkillVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class AdminSkillApi extends AbstractApi
{
    #[Inject]
    protected AdminSkillAppService $adminSkillAppService;

    /**
     * 查询技能版本列表.
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_ADMIN_AI_SKILL, MagicOperationEnum::QUERY)]
    public function queryVersions(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = QuerySkillVersionsRequestAdminDTO::fromRequest($this->request);

        return $this->adminSkillAppService->queryVersions($requestContext, $requestDTO)->toArray();
    }

    /**
     * 审核技能版本.
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_ADMIN_AI_SKILL, MagicOperationEnum::EDIT)]
    public function reviewSkillVersion(RequestContext $requestContext, int $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = ReviewSkillVersionRequestDTO::fromRequest($this->request);

        $this->adminSkillAppService->reviewSkillVersion($requestContext, $id, $requestDTO);
        return [];
    }
}
