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
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectMembersUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectShortcutCancelledEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectShortcutSetEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchUpdateMembersRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateMembersRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetCollaborationProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetParticipatedProjectsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectMembersRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectPinRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectShortcutRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CollaborationCreatorListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CollaborationProjectListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CollaboratorMemberDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CreatorInfoDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ParticipatedProjectListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectMembersResponseDTO;
use Psr\EventDispatcher\EventDispatcherInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberStatus;
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
        $memberEntities = $this->projectMemberDomainService->getProjectMembers($projectId, [MemberRole::EDITOR->value, MemberRole::VIEWER->value]);

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
        $collaborationProjects = match ($type) {
            'shared' => $this->getSharedProjectIds($userId, $dataIsolation->getCurrentOrganizationCode(), $requestDTO),
            default => $this->getReceivedProjectIds($userId, $dataIsolation, $requestDTO),
        };

        $projectIds = array_column($collaborationProjects['list'], 'project_id');
        $totalCount = $collaborationProjects['total'] ?? 0;

        if (empty($projectIds)) {
            return CollaborationProjectListResponseDTO::fromProjectData([], [], [], [], [], $totalCount)->toArray();
        }

        $result = $this->projectDomainService->getProjectsByConditions(
            ['project_ids' => $projectIds],
            $requestDTO->getPage(),
            $requestDTO->getPageSize()
        );

        return $this->buildCollaborationProjectResponse($dataIsolation, $result['list'], $collaborationProjects['list'], $totalCount);
    }

    /**
     * 更新项目置顶状态.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $projectId 项目ID
     * @param UpdateProjectPinRequestDTO $requestDTO 请求DTO
     */
    public function updateProjectPin(
        RequestContext $requestContext,
        int $projectId,
        UpdateProjectPinRequestDTO $requestDTO
    ): void {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 1. 验证并获取可访问的项目
        $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        // 2. 委托给Domain层处理业务逻辑
        $this->projectMemberDomainService->updateProjectPinStatus(
            $userAuthorization->getId(),
            $projectId,
            $userAuthorization->getOrganizationCode(),
            $requestDTO->isPinOperation()
        );
    }

    /**
     * Update project shortcut.
     */
    public function updateProjectShortcut(
        RequestContext $requestContext,
        int $projectId,
        UpdateProjectShortcutRequestDTO $requestDTO
    ): void {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 1. 验证并获取可访问的项目
        $projectEntity = $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
        if ($projectEntity->getUserId() === $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::CANNOT_SET_SHORTCUT_FOR_OWN_PROJECT);
        }

        // 2. 根据参数决定是设置还是取消快捷方式
        if ($requestDTO->getIsBindWorkspace() === 1) {
            $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail((int) $requestDTO->getWorkspaceId());
            if (! $workspaceEntity || $workspaceEntity->getUserId() !== $userAuthorization->getId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND);
            }
            // 设置快捷方式
            // 3. 委托给Domain层处理设置快捷方式
            $this->projectMemberDomainService->setProjectShortcut(
                $userAuthorization->getId(),
                $projectId,
                (int) $requestDTO->getWorkspaceId(),
                $userAuthorization->getOrganizationCode()
            );

            // 4. 发布项目快捷方式设置事件
            $projectShortcutSetEvent = new ProjectShortcutSetEvent($projectEntity, (int) $requestDTO->getWorkspaceId(), $userAuthorization);
            $this->eventDispatcher->dispatch($projectShortcutSetEvent);
        } else {
            // 取消快捷方式
            // 3. 委托给Domain层处理取消快捷方式
            $this->projectMemberDomainService->cancelProjectShortcut(
                $userAuthorization->getId(),
                $projectId
            );

            // 4. 发布项目快捷方式取消事件
            $projectShortcutCancelledEvent = new ProjectShortcutCancelledEvent($projectEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($projectShortcutCancelledEvent);
        }
    }

    /**
     * 获取协作项目创建者列表.
     */
    public function getCollaborationProjectCreators(RequestContext $requestContext): CollaborationCreatorListResponseDTO
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $requestContext->getDataIsolation();

        // 1. 获取用户所在部门ID列表
        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userAuthorization->getId(), true);

        // 2. 获取协作项目的创建者用户ID列表
        $creatorUserIds = $this->projectMemberDomainService->getCollaborationProjectCreatorIds(
            $userAuthorization->getId(),
            $departmentIds,
            $userAuthorization->getOrganizationCode()
        );

        $creatorUserIds = array_filter($creatorUserIds, function ($creatorUserId) use ($dataIsolation) {
            return ((string) $creatorUserId) !== $dataIsolation->getCurrentUserId();
        });

        if (empty($creatorUserIds)) {
            return CollaborationCreatorListResponseDTO::fromEmpty();
        }

        // 3. 批量获取创建者用户详细信息
        $userEntities = $this->magicUserDomainService->getByUserIds($dataIsolation, $creatorUserIds);

        // 4. 更新头像URL
        $this->updateUserAvatarUrl($dataIsolation, $userEntities);

        // 5. 创建响应DTO并返回
        return CollaborationCreatorListResponseDTO::fromUserEntities($userEntities);
    }

    /**
     * 获取用户参与的项目列表（包含协作项目）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param GetParticipatedProjectsRequestDTO $requestDTO 请求DTO
     */
    public function getParticipatedProjects(
        RequestContext $requestContext,
        GetParticipatedProjectsRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 1. 获取用户参与的项目列表
        $result = $this->projectMemberDomainService->getParticipatedProjectsWithCollaboration(
            $dataIsolation->getCurrentUserId(),
            $requestDTO->getWorkspaceId(),
            $requestDTO->getShowCollaboration(),
            $requestDTO->getProjectName(),
            $requestDTO->getPage(),
            $requestDTO->getPageSize()
        );

        // 2. 提取工作区ID并获取名称
        $workspaceIds = array_unique(array_map(fn ($project) => $project['workspace_id'], $result['list'] ?? []));
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);

        // 新增方法，根据$projectIds，判断是否存在数据，如果存在则返回存在的projectIds
        $projectIds = [];
        foreach ($result['list'] as $projectData) {
            $projectIds[] = $projectData['id'];
        }
        $projectMemberCounts = $this->projectMemberDomainService->getProjectMembersCounts($projectIds);
        $projectIdsWithMember = array_keys(array_filter($projectMemberCounts, fn ($count) => $count > 0));

        // 3. 使用统一的响应DTO处理方式
        $listResponseDTO = ParticipatedProjectListResponseDTO::fromResult($result, $workspaceNameMap, $projectIdsWithMember);

        return $listResponseDTO->toArray();
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
            $requestDTO->getName(),
            $requestDTO->getSortField(),
            $requestDTO->getSortDirection(),
            $requestDTO->getCreatorUserIds()
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
            $requestDTO->getPageSize(),
            $requestDTO->getSortField(),
            $requestDTO->getSortDirection(),
            $requestDTO->getCreatorUserIds()
        );
    }

    /**
     * 构建协作项目响应数据.
     */
    private function buildCollaborationProjectResponse(DataIsolation $dataIsolation, array $projects, array $collaborationProjects, int $totalCount): array
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
            $collaborationProjects,
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

    /**
     * 添加项目成员（仅支持组织内部成员）.
     */
    public function createMembers(RequestContext $requestContext, int $projectId, CreateMembersRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $currentUserId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 1. 获取项目
        $project = $this->projectDomainService->getProjectNotUserId($projectId);

        // 2. 验证用户是否为项目管理者或所有者
        $this->validateManageOrOwnerPermission($requestContext->getUserAuthorization(), $project);

        // 3. 检查项目协作是否开启
        if (!$project->getIsCollaborationEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.collaboration_disabled');
        }

        // 4. 提取请求数据
        $members = $requestDTO->getMembers();

        // 4. 构建成员实体列表
        $memberEntities = [];

        // 4.1 批量验证目标用户/部门在当前组织内
        $this->validateTargetsInOrganization($members, $organizationCode);

        foreach ($members as $memberData) {
            $memberEntity = new ProjectMemberEntity();
            $memberEntity->setProjectId($projectId);
            $memberEntity->setTargetType(MemberType::from($memberData['target_type']));
            $memberEntity->setTargetId($memberData['target_id']);
            $memberEntity->setRole(MemberRole::from($memberData['permission']));
            $memberEntity->setOrganizationCode($organizationCode);
            $memberEntity->setInvitedBy($currentUserId);
            $memberEntity->setStatus(MemberStatus::ACTIVE);

            $memberEntities[] = $memberEntity;
        }

        // 5. 添加成员
        $this->projectMemberDomainService->addInternalMembers($memberEntities, $organizationCode);

        // 6. 获取完整的成员信息（复用现有获取成员列表的逻辑）
        $addedMemberIds = array_map(fn ($entity) => $entity->getTargetId(), $memberEntities);

        return $this->projectMemberDomainService->getMembersByIds($projectId, $addedMemberIds);
    }

    /**
     * 获取项目协作设置.
     */
    public function getCollaborationSettings(RequestContext $requestContext, int $projectId): array
    {
        // 1. 验证项目权限
        $project = $this->projectDomainService->getProjectNotUserId($projectId);

        // 2. 验证管理者或所有者权限
        $this->validateManageOrOwnerPermission($requestContext->getUserAuthorization(), $project);

        return [
            'is_collaboration_enabled' => $project->getIsCollaborationEnabled(),
            'permission' => $project->getPermission()->value,
        ];
    }

    /**
     * 更新项目协作设置.
     */
    public function updateCollaboration(RequestContext $requestContext, int $projectId, bool $isEnabled): void
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $currentUserId = $userAuthorization->getId();

        // 1. 验证项目权限
        $project = $this->projectDomainService->getProjectNotUserId($projectId);

        if (!$project || $project->getUserId() !== $currentUserId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.no_manage_permission');
        }

        // 2. 更新协作状态
        $this->projectDomainService->updateCollaborationStatus($projectId, $isEnabled);
    }

    /**
     * 批量更新成员权限.
     */
    public function updateProjectMemberPermissions(RequestContext $requestContext, int $projectId, BatchUpdateMembersRequestDTO $requestDTO): array
    {
        $project = $this->projectDomainService->getProjectNotUserId($projectId);

        // 1. 验证权限
        $this->validateManageOrOwnerPermission($requestContext->getUserAuthorization(), $project);

        // 2. 提取请求数据
        $members = $requestDTO->getMembers();

        // 3. 验证批量操作
        $memberIds = array_column($members, 'member_id');

        // 检查是否为项目所有者
        $project = $this->projectDomainService->getProjectNotUserId($projectId);

        // 不能修改创建者权限
        if (in_array($project->getUserId(), $memberIds, true)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        // 4. 执行批量权限更新
        $this->projectMemberDomainService->batchUpdatePermissions($projectId, $members);

        return [];
    }

    /**
     * 批量删除成员.
     */
    public function deleteMembers(RequestContext $requestContext, int $projectId, array $memberIds): void
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $currentUserId = $userAuthorization->getId();

        // 获取项目
        $project = $this->projectDomainService->getProjectNotUserId($projectId);

        // 检查是否删除自己
        if (in_array($currentUserId, $memberIds, true)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        // 不能是否删除创建者
        if (in_array($project->getUserId(), $memberIds, true)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        // 1. 验证权限
        $this->validateManageOrOwnerPermission($requestContext->getUserAuthorization(), $project);

        // 2. 执行批量删除
        $this->projectMemberDomainService->batchDeleteMembers($projectId, $memberIds);
    }

    /**
     * 验证项目管理权限（统一权限验证逻辑）.
     */
    private function validateProjectPermission(int $projectId, string $userId, bool $requireOwnerOnly = false): void
    {
        // 检查是否为项目所有者
        $project = $this->projectDomainService->getProjectNotUserId((int) $projectId);
        if ($project && $project->getUserId() === $userId) {
            return; // 项目所有者通过验证
        }

        // 如果仅要求所有者权限，则停止检查
        if ($requireOwnerOnly) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.no_manage_permission');
        }

        // 检查是否为项目管理者
        $member = $this->projectMemberDomainService->getMemberByProjectAndUser($projectId, $userId);
        if (!$member || !in_array($member->getRole(), [MemberRole::MANAGE, MemberRole::OWNER], true)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.no_manage_permission');
        }
    }

    /**
     * 验证管理权限（仅管理者）.
     */
    private function validateManagePermission(int $projectId, string $userId): void
    {
        $this->validateProjectPermission($projectId, $userId, false);
    }

    /**
     * 验证管理者或所有者权限.
     */
    private function validateManageOrOwnerPermission(MagicUserAuthorization $magicUserAuthorization, ProjectEntity $projectEntity): void
    {
        $projectId = $projectEntity->getId();
        $currentUserId = $magicUserAuthorization->getId();

        if ($projectEntity->getCreatedUid() === $currentUserId) {
            return ;
        }

        // 检查是否具有管理权限
        $projectMemberEntity = $this->projectMemberDomainService->getMemberByProjectAndUser($projectId, $currentUserId);
        if ($projectMemberEntity && $projectMemberEntity->getRole()->hasManagePermission()) {
            return ;
        }

        $dataIsolation = DataIsolation::create($magicUserAuthorization->getOrganizationCode(), $currentUserId);
        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $currentUserId, true);
        $projectMemberEntities = $this->projectMemberDomainService->getMembersByProjectAndDepartmentIds($projectId, $departmentIds);

        foreach ($projectMemberEntities as $projectMemberEntity) {
            if ($projectMemberEntity->getRole()->hasManagePermission()) {
                return ;
            }
        }
        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
    }

    /**
     * 批量验证目标用户/部门在当前组织内.
     */
    private function validateTargetsInOrganization(array $members, string $organizationCode): void
    {
        // 分组收集用户ID和部门ID
        $userIds = [];
        $departmentIds = [];

        foreach ($members as $member) {
            if (MemberType::fromString($member['target_type'])->isUser()) {
                $userIds[] = $member['target_id'];
            } elseif (MemberType::fromString($member['target_type'])->isDepartment()) {
                $departmentIds[] = $member['target_id'];
            } else {
                ExceptionBuilder::throw(SuperAgentErrorCode::INVALID_MEMBER_TYPE);
            }
        }

        // 批量验证用户
        if (!empty($userIds)) {
            $dataIsolation = DataIsolation::create($organizationCode, '');
            $validUsers = $this->magicUserDomainService->getByUserIds($dataIsolation, $userIds);
            $validUserIds = array_map(fn ($user) => $user->getUserId(), $validUsers);

            $invalidUserIds = array_diff($userIds, $validUserIds);
            if (!empty($invalidUserIds)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.member_not_found');
            }
        }

        // 批量验证部门
        if (!empty($departmentIds)) {
            $dataIsolation = DataIsolation::create($organizationCode, '');
            $validDepartments = $this->departmentDomainService->getDepartmentByIds($dataIsolation, $departmentIds);
            $validDepartmentIds = array_map(fn ($dept) => $dept->getDepartmentId(), $validDepartments);

            $invalidDepartmentIds = array_diff($departmentIds, $validDepartmentIds);
            if (!empty($invalidDepartmentIds)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::DEPARTMENT_NOT_FOUND, 'project.department_not_found');
            }
        }
    }

}
