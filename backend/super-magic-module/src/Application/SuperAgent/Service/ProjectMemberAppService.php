<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectMembersUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetCollaborationProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectMembersRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CollaborationProjectListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CollaboratorMemberDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CreatorInfoDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectMembersResponseDTO;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;

/**
 * 项目成员应用服务
 *
 * 负责编排项目成员相关的业务流程，不包含具体业务逻辑
 */
class ProjectMemberAppService extends AbstractAppService
{
    public function __construct(
        private readonly LoggerInterface $logger,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly MagicDepartmentDomainService $departmentDomainService,
        private readonly MagicDepartmentUserDomainService $departmentUserDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly EventDispatcherInterface $eventDispatcher,
    ) {
    }

    /**
     * 更新项目成员.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param UpdateProjectMembersRequestDTO $requestDTO 请求DTO
     */
    public function updateProjectMembers(
        RequestContext $requestContext,
        UpdateProjectMembersRequestDTO $requestDTO
    ): void {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 1. DTO转换为Entity
        $projectId = (int) $requestDTO->getProjectId();
        $memberEntities = [];

        foreach ($requestDTO->getMembers() as $memberData) {
            $entity = new ProjectMemberEntity();
            $entity->setTargetTypeFromString($memberData['target_type']);
            $entity->setTargetId($memberData['target_id']);
            $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
            $entity->setInvitedBy($userAuthorization->getId());

            $memberEntities[] = $entity;
        }

        // 2. 验证并获取可访问的项目
        $projectEntity = $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        // 3. 委托给Domain层处理业务逻辑
        $this->projectMemberDomainService->updateProjectMembers(
            $requestContext->getOrganizationCode(),
            $projectId,
            $memberEntities
        );

        // 4. 发布项目成员已更新事件
        $projectMembersUpdatedEvent = new ProjectMembersUpdatedEvent($projectEntity, $memberEntities, $userAuthorization);
        $this->eventDispatcher->dispatch($projectMembersUpdatedEvent);

        // 5. 记录成功日志
        $this->logger->info('Project members updated successfully', [
            'project_id' => $projectId,
            'operator_id' => $requestContext->getUserId(),
            'member_count' => count($memberEntities),
            'timestamp' => time(),
        ]);
    }

    /**
     * 获取项目成员列表.
     */
    public function getProjectMembers(RequestContext $requestContext, int $projectId): ProjectMembersResponseDTO
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 1. 验证并获取可访问的项目
        $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        // 2. 获取项目成员列表
        $memberEntities = $this->projectMemberDomainService->getProjectMembers($projectId);

        if (empty($memberEntities)) {
            return ProjectMembersResponseDTO::fromEmpty();
        }

        // 3. 分组获取用户和部门ID
        $userIds = [];
        $departmentIds = [];

        foreach ($memberEntities as $entity) {
            if ($entity->getTargetType()->isUser()) {
                $userIds[] = $entity->getTargetId();
            } elseif ($entity->getTargetType()->isDepartment()) {
                $departmentIds[] = $entity->getTargetId();
            }
        }

        // 4. 创建数据隔离对象
        $dataIsolation = $requestContext->getDataIsolation();

        // 获取用户所属部门
        $departmentUsers = $this->departmentUserDomainService->getDepartmentUsersByUserIds($userIds, $dataIsolation);
        $userIdMapDepartmentIds = array_column($departmentUsers, 'department_id', 'userId');
        $allDepartmentIds = array_merge($departmentIds, array_values($userIdMapDepartmentIds));

        // 获取部门详情
        $depIdMapDepartmentsInfos = $this->departmentDomainService->getDepartmentFullPathByIds($dataIsolation, $allDepartmentIds);

        // 5. 获取用户详细信息
        $users = [];
        if (! empty($userIds)) {
            $userEntities = $this->magicUserDomainService->getByUserIds($dataIsolation, $userIds);
            $this->updateUserAvatarUrl($dataIsolation, $userEntities);

            foreach ($userEntities as $userEntity) {
                $pathNodes = [];
                if (isset($userIdMapDepartmentIds[$userEntity->getUserId()])) {
                    foreach ($depIdMapDepartmentsInfos[$userIdMapDepartmentIds[$userEntity->getUserId()]] ?? [] as $departmentInfo) {
                        $pathNodes[] = $this->assemblePathNodeByDepartmentInfo($departmentInfo);
                    }
                }

                $users[] = [
                    'id' => (string) $userEntity->getId(),
                    'user_id' => $userEntity->getUserId(),
                    'name' => $userEntity->getNickname(),
                    'i18n_name' => $userEntity->getI18nName() ?? '',
                    'organization_code' => $userEntity->getOrganizationCode(),
                    'avatar_url' => $userEntity->getAvatarUrl() ?? '',
                    'type' => 'User',
                    'path_nodes' => $pathNodes,
                ];
            }
        }

        // 6. 获取部门详细信息
        $departments = [];
        if (! empty($departmentIds)) {
            $departmentEntities = $this->departmentDomainService->getDepartmentByIds($dataIsolation, $departmentIds);
            foreach ($departmentEntities as $departmentEntity) {
                $pathNodes = [];
                foreach ($depIdMapDepartmentsInfos[$departmentEntity->getDepartmentId()] ?? [] as $departmentInfo) {
                    $pathNodes[] = $this->assemblePathNodeByDepartmentInfo($departmentInfo);
                }
                $departments[] = [
                    'id' => (string) $departmentEntity->getId(),
                    'department_id' => $departmentEntity->getDepartmentId(),
                    'name' => $departmentEntity->getName(),
                    'i18n_name' => $departmentEntity->getI18nName() ?? '',
                    'organization_code' => $requestContext->getOrganizationCode(),
                    'avatar_url' => '',
                    'type' => 'Department',
                    'path_nodes' => $pathNodes,
                ];
            }
        }

        // 7. 使用ResponseDTO返回结果
        return ProjectMembersResponseDTO::fromMemberData($users, $departments);
    }

    /**
     * 获取协作项目列表
     * 根据type参数获取不同类型的协作项目：
     * - received: 他人分享给我的协作项目
     * - shared: 我分享给他人的协作项目.
     */
    public function getCollaborationProjects(RequestContext $requestContext, GetCollaborationProjectListRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $userId = $dataIsolation->getCurrentUserId();
        $type = $requestDTO->getType() ?: 'received';

        // 根据类型获取项目ID列表
        $collaborationResult = match ($type) {
            'shared' => $this->getSharedProjectIds($userId, $dataIsolation->getCurrentOrganizationCode(), $requestDTO),
            default => $this->getReceivedProjectIds($userId, $dataIsolation, $requestDTO),
        };

        $projectIds = $collaborationResult['project_ids'] ?? [];
        $totalCount = $collaborationResult['total'] ?? 0;

        if (empty($projectIds)) {
            return CollaborationProjectListResponseDTO::fromProjectData([], [], [], [], $totalCount)->toArray();
        }

        $result = $this->projectDomainService->getProjectsByConditions(
            ['project_ids' => $projectIds],
            $requestDTO->getPage(),
            $requestDTO->getPageSize()
        );

        return $this->buildCollaborationProjectResponse($dataIsolation, $result['list'], $totalCount);
    }

    /**
     * 获取他人分享给我的项目ID列表.
     * @param mixed $dataIsolation
     */
    private function getReceivedProjectIds(string $userId, $dataIsolation, GetCollaborationProjectListRequestDTO $requestDTO): array
    {
        // 获取用户所在的所有部门（包含父级部门）
        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId(
            $dataIsolation,
            $userId,
            true // 包含父级部门
        );

        // 获取协作项目ID列表及总数
        return $this->projectMemberDomainService->getProjectIdsByUserAndDepartmentsWithTotal(
            $userId,
            $departmentIds,
            $requestDTO->getName()
        );
    }

    /**
     * 获取我分享给他人的项目ID列表.
     */
    private function getSharedProjectIds(string $userId, string $organizationCode, GetCollaborationProjectListRequestDTO $requestDTO): array
    {
        // 直接调用优化后的Repository方法，在数据库层面就完成分页和过滤
        return $this->projectMemberDomainService->getSharedProjectIdsByUserWithTotal(
            $userId,
            $organizationCode,
            $requestDTO->getName(),
            $requestDTO->getPage(),
            $requestDTO->getPageSize()
        );
    }

    /**
     * 构建协作项目响应数据.
     * @param mixed $dataIsolation
     */
    private function buildCollaborationProjectResponse($dataIsolation, array $projects, int $totalCount): array
    {
        // 1. 获取创建人信息
        $creatorUserIds = array_unique(array_map(fn ($project) => $project->getUserId(), $projects));
        $creatorInfoMap = [];
        if (! empty($creatorUserIds)) {
            $creatorUsers = $this->magicUserDomainService->getByUserIds($dataIsolation, $creatorUserIds);
            foreach ($creatorUsers as $user) {
                $creatorInfoMap[$user->getUserId()] = CreatorInfoDTO::fromUserEntity($user);
            }
        }

        // 2. 分别获取协作者信息（拆分接口）
        $projectIdsFromResult = array_map(fn ($project) => $project->getId(), $projects);

        // 2.1 获取项目成员总数
        $memberCounts = $this->projectMemberDomainService->getProjectMembersCounts($projectIdsFromResult);

        // 2.2 获取项目前4个成员预览
        $membersPreview = $this->projectMemberDomainService->getProjectMembersPreview($projectIdsFromResult, 4);

        $collaboratorsInfoMap = [];

        foreach ($projectIdsFromResult as $projectId) {
            $memberInfo = $membersPreview[$projectId] ?? [];
            $memberCount = $memberCounts[$projectId] ?? 0;

            // 分离用户和部门
            $userIds = [];
            $departmentIds = [];
            foreach ($memberInfo as $member) {
                if ($member->getTargetType()->isUser()) {
                    $userIds[] = $member->getTargetId();
                } elseif ($member->getTargetType()->isDepartment()) {
                    $departmentIds[] = $member->getTargetId();
                }
            }

            // 获取用户和部门信息
            $userEntities = ! empty($userIds) ? $this->magicUserDomainService->getByUserIds($dataIsolation, $userIds) : [];
            $departmentEntities = ! empty($departmentIds) ? $this->departmentDomainService->getDepartmentByIds($dataIsolation, $departmentIds) : [];

            // 直接创建CollaboratorMemberDTO数组
            $members = [];

            $this->updateUserAvatarUrl($dataIsolation, $userEntities);
            foreach ($userEntities as $userEntity) {
                $members[] = CollaboratorMemberDTO::fromUserEntity($userEntity);
            }
            foreach ($departmentEntities as $departmentEntity) {
                $members[] = CollaboratorMemberDTO::fromDepartmentEntity($departmentEntity);
            }

            $collaboratorsInfoMap[$projectId] = [
                'members' => $members,
                'member_count' => $memberCount,
            ];
        }

        // 3. 提取工作区ID并获取名称
        $workspaceIds = array_unique(array_map(fn ($project) => $project->getWorkspaceId(), $projects));
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);

        // 4. 创建协作项目列表响应DTO
        $collaborationListResponseDTO = CollaborationProjectListResponseDTO::fromProjectData(
            $projects,
            $creatorInfoMap,
            $collaboratorsInfoMap,
            $workspaceNameMap,
            $totalCount
        );

        return $collaborationListResponseDTO->toArray();
    }

    private function updateUserAvatarUrl(DataIsolation $dataIsolation, array $userEntities): void
    {
        $urlMapRealUrl = $this->getUserAvatarUrls($dataIsolation, $userEntities);

        foreach ($userEntities as $userEntity) {
            $userEntity->setAvatarUrl($urlMapRealUrl[$userEntity->getAvatarUrl()] ?? '');
        }
    }

    private function getUserAvatarUrls(DataIsolation $dataIsolation, array $userEntities): array
    {
        $avatarUrlMapRealUrl = [];
        $urlPaths = [];
        foreach ($userEntities as $userEntity) {
            if (str_starts_with($userEntity->getAvatarUrl(), 'http')) {
                $avatarUrlMapRealUrl[$userEntity->getAvatarUrl()] = $userEntity->getAvatarUrl();
            } else {
                $urlPaths[] = $userEntity->getAvatarUrl();
            }
        }
        $urlPaths = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $urlPaths);
        foreach ($urlPaths as $path => $urlPath) {
            $avatarUrlMapRealUrl[$path] = $urlPath->getUrl();
        }
        return array_merge($urlPaths, $avatarUrlMapRealUrl);
    }

    private function assemblePathNodeByDepartmentInfo(MagicDepartmentEntity $departmentInfo): array
    {
        return [
            // 部门名称
            'department_name' => $departmentInfo->getName(),
            // 部门id
            'department_id' => $departmentInfo->getDepartmentId(),
            'parent_department_id' => $departmentInfo->getParentDepartmentId(),
            // 部门路径
            'path' => $departmentInfo->getPath(),
            // 可见性
            'visible' => ! ($departmentInfo->getOption() === DepartmentOption::Hidden),
            'option' => $departmentInfo->getOption(),
        ];
    }
}
