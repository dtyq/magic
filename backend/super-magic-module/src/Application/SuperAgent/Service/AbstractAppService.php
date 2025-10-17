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
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\Logger\LoggerFactory;

class AbstractAppService extends AbstractKernelAppService
{
    use DataIsolationTrait;

    /**
     * 获取用户可访问的项目实体.
     *
     * @return ProjectEntity 项目实体
     */
    public function getAccessibleProject(int $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        $projectDomainService = di(ProjectDomainService::class);
        $projectMemberService = di(ProjectMemberDomainService::class);
        $magicDepartmentUserDomainService = di(MagicDepartmentUserDomainService::class);
        $logger = di(LoggerFactory::class)->get(get_class($this));

        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);

        if ($projectEntity->getUserOrganizationCode() !== $organizationCode) {
            $logger->error('Project access denied', [
                'projectId' => $projectId,
                'userId' => $userId,
                'organizationCode' => $organizationCode,
                'projectUserOrganizationCode' => $projectEntity->getUserOrganizationCode(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        if ($projectEntity->getUserId() === $userId) {
            return $projectEntity;
        }

        if ($projectMemberService->isProjectMemberByUser($projectId, $userId)) {
            return $projectEntity;
        }

        $dataIsolation = DataIsolation::create($organizationCode, $userId);

        $departmentIds = $magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);

        if (! empty($departmentIds)) {
            if ($projectMemberService->isProjectMemberByDepartments($projectId, $departmentIds)) {
                return $projectEntity;
            }
        }

        $logger->error('Project access denied', [
            'projectId' => $projectId,
            'userId' => $userId,
            'organizationCode' => $organizationCode,
            'projectUserOrganizationCode' => $projectEntity->getUserOrganizationCode(),
        ]);

        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
    }

    /**
     * 验证管理者或所有者权限.
     */
    protected function validateManageOrOwnerPermission(MagicUserAuthorization $magicUserAuthorization, ProjectEntity $projectEntity): void
    {
        $projectMemberService = di(ProjectMemberDomainService::class);
        $magicDepartmentUserDomainService = di(MagicDepartmentUserDomainService::class);

        $projectId = $projectEntity->getId();
        $currentUserId = $magicUserAuthorization->getId();

        if ($projectEntity->getCreatedUid() === $currentUserId) {
            return ;
        }

        // 检查是否具有管理权限
        $projectMemberEntity = $projectMemberService->getMemberByProjectAndUser($projectId, $currentUserId);
        if ($projectMemberEntity && $projectMemberEntity->getRole()->hasManagePermission()) {
            return ;
        }

        $dataIsolation = DataIsolation::create($magicUserAuthorization->getOrganizationCode(), $currentUserId);
        $departmentIds = $magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $currentUserId, true);
        $projectMemberEntities = $projectMemberService->getMembersByProjectAndDepartmentIds($projectId, $departmentIds);

        foreach ($projectMemberEntities as $projectMemberEntity) {
            if ($projectMemberEntity->getRole()->hasManagePermission()) {
                return ;
            }
        }
        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
    }

}
