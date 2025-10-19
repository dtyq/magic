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
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
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
    public function getAccessibleProject(int $projectId, string $userId, string $organizationCode, MemberRole $requiredRole = MemberRole::VIEWER): ProjectEntity
    {
        $projectDomainService = di(ProjectDomainService::class);
        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);

        /*if ($projectEntity->getUserOrganizationCode() !== $organizationCode) {
            $logger->error('Project access denied', [
                'projectId' => $projectId,
                'userId' => $userId,
                'organizationCode' => $organizationCode,
                'projectUserOrganizationCode' => $projectEntity->getUserOrganizationCode(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }*/

        // 如果是创建者，直接返回
        if ($projectEntity->getUserId() === $userId) {
            return $projectEntity;
        }

        // 验证身份
        if ($requiredRole) {
            $magicUserAuthorization = new MagicUserAuthorization();
            $magicUserAuthorization->setOrganizationCode($organizationCode);
            $magicUserAuthorization->setId($userId);
            $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, $requiredRole);
            return $projectEntity;
        }

        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
    }

    /**
     * 验证管理者或所有者权限.
     */
    protected function validateManageOrOwnerPermission(MagicUserAuthorization $magicUserAuthorization, int $projectId): void
    {
        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, MemberRole::MANAGE);
    }

    /**
     * 验证可编辑者权限.
     */
    protected function validateEditorPermission(MagicUserAuthorization $magicUserAuthorization, int $projectId): void
    {
        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, MemberRole::EDITOR);
    }

    /**
     * 验证可读权限.
     */
    protected function validateViewerPermission(MagicUserAuthorization $magicUserAuthorization, int $projectId): void
    {
        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, MemberRole::VIEWER);
    }

    /**
     * 验证当前用户角色是否大于或等于指定角色.
     */
    protected function validateRoleHigherOrEqual(MagicUserAuthorization $magicUserAuthorization, int $projectId, MemberRole $requiredRole): void
    {
        $projectMemberService = di(ProjectMemberDomainService::class);
        $magicDepartmentUserDomainService = di(MagicDepartmentUserDomainService::class);
        $userId = $magicUserAuthorization->getId();

        /*$projectId = $projectEntity->getId();

        if ($projectEntity->getCreatedUid() === $userId) {
            return;
        }*/

        $projectMemberEntity = $projectMemberService->getMemberByProjectAndUser($projectId, $userId);

        if ($projectMemberEntity && $projectMemberEntity->getRole()->isHigherOrEqualThan($requiredRole)) {
            return;
        }

        $dataIsolation = DataIsolation::create($magicUserAuthorization->getOrganizationCode(), $userId);
        $departmentIds = $magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);
        $projectMemberEntities = $projectMemberService->getMembersByProjectAndDepartmentIds($projectId, $departmentIds);

        foreach ($projectMemberEntities as $projectMemberEntity) {
            if ($projectMemberEntity->getRole()->isHigherOrEqualThan($requiredRole)) {
                return;
            }
        }
        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
    }
}
