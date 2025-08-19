<?php

declare(strict_types=1);

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CollaborationProjectListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CollaboratorMemberDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CreatorInfoDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectMembersResponseDTO;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectMembersRequestDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
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
    ) {
    }

    /**
     * 更新项目成员
     *
     * @param RequestContext $requestContext 请求上下文
     * @param UpdateProjectMembersRequestDTO $requestDTO 请求DTO
     *
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
        $this->getAccessibleProject($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        // 3. 委托给Domain层处理业务逻辑
        $this->projectMemberDomainService->updateProjectMembers(
            $requestContext->getOrganizationCode(),
            $projectId,
            $memberEntities
        );

        // 4. 记录成功日志
        $this->logger->info('Project members updated successfully', [
            'project_id' => $projectId,
            'operator_id' => $requestContext->getUserId(),
            'member_count' => count($memberEntities),
            'timestamp' => time(),
        ]);
    }

    /**
     * 获取项目成员列表
     *
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

        // 5. 获取用户详细信息
        $users = [];
        if (!empty($userIds)) {
            $userEntities = $this->magicUserDomainService->getByUserIds($dataIsolation, $userIds);
            $this->updateUserAvatarUrl($dataIsolation, $userEntities);

            foreach ($userEntities as $userEntity) {
                $users[] = [
                    'id' => (string) $userEntity->getId(),
                    'user_id' => $userEntity->getUserId(),
                    'name' => $userEntity->getNickname(),
                    'i18n_name' => $userEntity->getI18nName() ?? '',
                    'organization_code' => $userEntity->getOrganizationCode(),
                    'avatar_url' => $userEntity->getAvatarUrl() ?? '',
                    'type' => 'User'
                ];
            }
        }

        // 6. 获取部门详细信息
        $departments = [];
        if (!empty($departmentIds)) {
            $departmentEntities = $this->departmentDomainService->getDepartmentByIds($dataIsolation, $departmentIds);
            foreach ($departmentEntities as $departmentEntity) {
                $departments[] = [
                    'id' => (string) $departmentEntity->getId(),
                    'department_id' => $departmentEntity->getDepartmentId(),
                    'name' => $departmentEntity->getName(),
                    'i18n_name' => $departmentEntity->getI18nName() ?? '',
                    'organization_code' => $requestContext->getOrganizationCode(),
                    'avatar_url' => '',
                    'type' => 'Department'
                ];
            }
        }

        // 7. 使用ResponseDTO返回结果
        return ProjectMembersResponseDTO::fromMemberData($users, $departments);
    }

    private function updateUserAvatarUrl(DataIsolation $dataIsolation, array $userEntities): void
    {
        $urlMapRealUrl = $this->getUserAvatarUrls($dataIsolation, $userEntities);

        foreach ($userEntities as $userEntity) {
            $userEntity->setAvatarUrl($urlMapRealUrl[$userEntity->getAvatarUrl()]);
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

    /**
     * 获取协作项目列表
     * 根据当前用户和用户所在部门获取所有协作项目
     */
    public function getCollaborationProjects(RequestContext $requestContext, GetProjectListRequestDTO $requestDTO): array
    {
        // Get user authorization information
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $userId = $dataIsolation->getCurrentUserId();

        // 1. 获取用户所在的所有部门（包含父级部门）
        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId(
            $dataIsolation,
            $userId,
            true // 包含父级部门
        );

        // 2. 获取协作项目ID列表及总数
        $collaborationResult = $this->projectMemberDomainService->getProjectIdsByUserAndDepartmentsWithTotal($userId, $departmentIds);
        $projectIds = $collaborationResult['project_ids'] ?? [];
        $totalCollaborationProjects = $collaborationResult['total'] ?? 0;

        if (empty($projectIds)) {
            return CollaborationProjectListResponseDTO::fromProjectData([], [], [], [], $totalCollaborationProjects)->toArray();
        }

        // 3. 设置查询条件，复用getProjectList逻辑
        $conditions = [
            'project_ids' => $projectIds, // 传递项目ID数组
        ];

        // 4. 调用Domain层获取项目详情（复用现有逻辑）
        $result = $this->projectDomainService->getProjectsByConditions(
            $conditions,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
        );

        if (empty($result['list'])) {
            return CollaborationProjectListResponseDTO::fromProjectData([], [], [], [], $totalCollaborationProjects)->toArray();
        }

        $projects = $result['list'];

        // 5. 获取创建人信息
        $creatorUserIds = array_unique(array_map(fn ($project) => $project->getUserId(), $projects));
        $creatorInfoMap = [];
        if (!empty($creatorUserIds)) {
            $creatorUsers = $this->magicUserDomainService->getByUserIds($dataIsolation, $creatorUserIds);
            foreach ($creatorUsers as $user) {
                $creatorInfoMap[$user->getUserId()] = CreatorInfoDTO::fromUserEntity($user);
            }
        }

        // 6. 分别获取协作者信息（拆分接口）
        $projectIdsFromResult = array_map(fn ($project) => $project->getId(), $projects);

        // 6.1 获取项目成员总数
        $memberCounts = $this->projectMemberDomainService->getProjectMembersCounts($projectIdsFromResult);

        // 6.2 获取项目前4个成员预览
        $membersPreview = $this->projectMemberDomainService->getProjectMembersPreview($projectIdsFromResult, 4);

        $collaboratorsInfoMap = [];

        foreach ($projectIdsFromResult as $projectId) {
            $memberInfo = $membersPreview[$projectId] ?? [];
            $totalCount = $memberCounts[$projectId] ?? 0;

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
            $userEntities = !empty($userIds) ? $this->magicUserDomainService->getByUserIds($dataIsolation, $userIds) : [];
            $departmentEntities = !empty($departmentIds) ? $this->departmentDomainService->getDepartmentByIds($dataIsolation, $departmentIds) : [];

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
                'member_count' => $totalCount
            ];
        }

        // 7. 提取工作区ID并获取名称
        $workspaceIds = array_unique(array_map(fn ($project) => $project->getWorkspaceId(), $projects));
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);

        // 8. 创建协作项目列表响应DTO（使用真正的协作项目总数）
        $collaborationListResponseDTO = CollaborationProjectListResponseDTO::fromProjectData(
            $projects,
            $creatorInfoMap,
            $collaboratorsInfoMap,
            $workspaceNameMap,
            $totalCollaborationProjects
        );

        return $collaborationListResponseDTO->toArray();
    }

}
