<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\DataIsolationTrait;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

class AbstractAppService extends AbstractKernelAppService
{
    use DataIsolationTrait;

    /**
     * 获取用户可访问的项目实体（默认大于可读角色）.
     *
     * @return ProjectEntity 项目实体
     */
    public function getAccessibleProject(int $projectId, string $userId, string $organizationCode, MemberRole $requiredRole = MemberRole::VIEWER): ProjectEntity
    {
        $projectDomainService = di(ProjectDomainService::class);
        $packageFilterService = di(PackageFilterInterface::class);
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

        // 判断是否开启共享项目
        if (! $projectEntity->getIsCollaborationEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        // 验证身份
        $magicUserAuthorization = new MagicUserAuthorization();
        $magicUserAuthorization->setOrganizationCode($organizationCode);
        $magicUserAuthorization->setId($userId);
        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, $requiredRole);

        // 判断是否付费套餐
        if (! $packageFilterService->isPaidSubscription($projectEntity->getUserOrganizationCode())) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }
        return $projectEntity;
    }

    /**
     * 获取用户可访问的项目实体（大于编辑角色）.
     */
    public function getAccessibleProjectWithEditor(int $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        return $this->getAccessibleProject($projectId, $userId, $organizationCode, MemberRole::EDITOR);
    }

    /**
     * 获取用户可访问的项目实体（大于管理角色）.
     */
    public function getAccessibleProjectWithManager(int $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        return $this->getAccessibleProject($projectId, $userId, $organizationCode, MemberRole::MANAGE);
    }

    /**
     * @return null|array<string, mixed>
     */
    protected function resolveVideoModelConfig(?array $videoModel, ?DataIsolation $dataIsolation = null): ?array
    {
        return di(VideoModelConfigResolver::class)->resolve($videoModel, $dataIsolation);
    }

    /**
     * @param null|array<string, mixed> $extraData
     * @return null|array<string, mixed>
     */
    protected function appendVideoModelExtraData(?array $extraData, ?SuperAgentExtra $extra, ?DataIsolation $dataIsolation = null): ?array
    {
        if ($extra === null) {
            return $extraData;
        }

        $videoModel = $this->resolveVideoModelConfig($extra->getVideoModel(), $dataIsolation);
        if ($videoModel === null) {
            return $extraData;
        }

        $extraData ??= [];
        if (isset($videoModel['model_id']) && is_string($videoModel['model_id']) && $videoModel['model_id'] !== '') {
            $extraData['video_model_id'] = $videoModel['model_id'];
        }
        if (is_array($videoModel['video_generation_config'] ?? null)) {
            $extraData['video_generation_config'] = $videoModel['video_generation_config'];
        }

        return $extraData === [] ? null : $extraData;
    }

    protected function appendVideoModelDynamicConfig(TaskContext $taskContext, ?SuperAgentExtra $extra): TaskContext
    {
        if ($extra === null) {
            return $taskContext;
        }

        $videoModel = $this->resolveVideoModelConfig($extra->getVideoModel(), $taskContext->getDataIsolation());
        if ($videoModel === null) {
            return $taskContext;
        }

        $dynamicConfig = $taskContext->getDynamicConfig();
        $dynamicConfig['video_model'] = array_filter([
            'model_id' => $videoModel['model_id'] ?? null,
            'video_generation_config' => is_array($videoModel['video_generation_config'] ?? null)
                ? $videoModel['video_generation_config']
                : null,
        ], static fn (mixed $value): bool => $value !== null);

        return $taskContext->setDynamicConfig($dynamicConfig);
    }

    /**
     * 验证管理者或所有者权限.
     */
    protected function validateManageOrOwnerPermission(MagicUserAuthorization $magicUserAuthorization, int $projectId): void
    {
        $projectDomainService = di(ProjectDomainService::class);
        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);
        // 判断是否开启共享项目
        if (! $projectEntity->getIsCollaborationEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, MemberRole::MANAGE);
    }

    /**
     * 验证可编辑者权限.
     */
    protected function validateEditorPermission(MagicUserAuthorization $magicUserAuthorization, int $projectId): void
    {
        $projectDomainService = di(ProjectDomainService::class);
        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);
        // 判断是否开启共享项目
        if (! $projectEntity->getIsCollaborationEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, MemberRole::EDITOR);
    }

    /**
     * 验证可读权限.
     */
    protected function validateViewerPermission(MagicUserAuthorization $magicUserAuthorization, int $projectId): void
    {
        $projectDomainService = di(ProjectDomainService::class);
        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);
        // 判断是否开启共享项目
        if (! $projectEntity->getIsCollaborationEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

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
