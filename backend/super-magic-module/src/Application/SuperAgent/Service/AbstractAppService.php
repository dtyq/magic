<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\DataIsolationTrait;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

class AbstractAppService extends AbstractKernelAppService
{
    use DataIsolationTrait;

    /**
     * 获取用户可访问的项目实体.
     *
     * @return ProjectEntity 项目实体
     */
    protected function getAccessibleProject(int $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        $projectDomainService = di(ProjectDomainService::class);
        $projectMemberService = di(ProjectMemberDomainService::class);
        $magicDepartmentUserDomainService = di(MagicDepartmentUserDomainService::class);

        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);

        if ($projectEntity->getUserOrganizationCode() !== $organizationCode) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        if ($projectEntity->getUserId() === $userId) {
            return $projectEntity;
        }

        if ($projectMemberService->isProjectMemberByUser($projectId, $userId)) {
            return $projectEntity;
        }

        $dataIsolation = DataIsolation::create($organizationCode, $userId);

        $departmentIds = $magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId,true);

        if (!empty($departmentIds)) {
            if ($projectMemberService->isProjectMemberByDepartments($projectId, $departmentIds)) {
                return $projectEntity;
            }
        }

        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
    }
}
