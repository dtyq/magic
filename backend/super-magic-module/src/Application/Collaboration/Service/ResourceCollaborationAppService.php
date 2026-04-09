<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Collaboration\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Application\Collaboration\Contract\CollaborativeResourceAdapterInterface;
use Dtyq\SuperMagic\Application\Collaboration\Policy\ResourceAccessPolicyService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberJoinMethod;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberType;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Hyperf\DbConnection\Annotation\Transactional;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * 资源协作编排服务。
 *
 * 负责统一编排协作者的查询、新增、删除和改权流程，
 * 并协调协作权限表与项目成员表的双写逻辑。
 */
class ResourceCollaborationAppService extends AbstractKernelAppService
{
    /**
     * 注入协作编排所需的权限、成员和通讯录依赖。
     */
    public function __construct(
        private readonly ResourceAccessPolicyService $resourceAccessPolicyService,
        private readonly OperationPermissionDomainService $operationPermissionDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly MagicDepartmentDomainService $magicDepartmentDomainService,
    ) {
    }

    /**
     * 查询资源协作者列表。
     *
     * 列表主读协作权限表，并补齐用户、部门等展示信息。
     *
     * @return array{users: array<int, array>, departments: array<int, array>}
     */
    public function getCollaborators(
        CollaborativeResourceAdapterInterface $adapter,
        Authenticatable $authorization,
        string $code
    ): array {
        // 先确认资源真实存在，再做协作者列表查询。
        $adapter->getResource($authorization, $code);

        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
        $this->resourceAccessPolicyService->assertManageable($permissionDataIsolation, $adapter->getOperationResourceType(), $code);

        return $this->buildCollaboratorPayload($permissionDataIsolation, $code, $adapter);
    }

    /**
     * 新增资源协作者，并同步权限表与项目成员表。
     *
     * @param array<int, array{target_type: string, target_id: string, role: string}> $members
     * @return array{users: array<int, array>, departments: array<int, array>}
     */
    #[Transactional]
    public function addCollaborators(
        CollaborativeResourceAdapterInterface $adapter,
        Authenticatable $authorization,
        string $code,
        array $members
    ): array {
        // 协作者入口采用“单入口双写”：主写协作权限表，同时同步项目成员表。
        $resource = $adapter->getResource($authorization, $code);
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
        $currentOperation = $this->assertManageableAndGetCurrentOperation($adapter, $permissionDataIsolation, $code);

        $projectId = $adapter->getProjectId($resource);
        $ownerId = $adapter->getOwnerId($resource);
        $operationPermissions = $this->normalizeMemberPermissions($permissionDataIsolation, $adapter, $code, $members, true);

        $this->assertProjectBound($projectId);

        $this->validateMemberPermissions($permissionDataIsolation, $operationPermissions, $ownerId, $currentOperation);

        $this->syncProjectMembers(
            $permissionDataIsolation,
            $projectId,
            $operationPermissions
        );
        $this->operationPermissionDomainService->batchUpsertResourceOperations(
            $permissionDataIsolation,
            $adapter->getOperationResourceType(),
            $code,
            $operationPermissions
        );

        return $this->buildCollaboratorPayload($permissionDataIsolation, $code, $adapter);
    }

    /**
     * 删除资源协作者，并同步删除权限表与项目成员表中的对应记录。
     *
     * @param array<int, array{target_type: string, target_id: string}> $members
     */
    #[Transactional]
    public function removeCollaborators(
        CollaborativeResourceAdapterInterface $adapter,
        Authenticatable $authorization,
        string $code,
        array $members
    ): void {
        $resource = $adapter->getResource($authorization, $code);
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
        $currentOperation = $this->assertManageableAndGetCurrentOperation($adapter, $permissionDataIsolation, $code);

        $projectId = $adapter->getProjectId($resource);
        $ownerId = $adapter->getOwnerId($resource);

        $operationPermissions = $this->normalizeMemberPermissions($permissionDataIsolation, $adapter, $code, $members, false);

        $this->assertProjectBound($projectId);
        $this->validateMemberPermissions($permissionDataIsolation, $operationPermissions, $ownerId, $currentOperation, false);

        $targets = $this->extractProjectMemberTargets($operationPermissions);
        $this->projectMemberDomainService->deleteMembersByTargets($projectId, $targets);

        $this->operationPermissionDomainService->deleteResourceOperationsByTargets(
            $permissionDataIsolation,
            $adapter->getOperationResourceType(),
            $code,
            $targets
        );
    }

    /**
     * 更新资源协作者角色，并同步更新权限表与项目成员表。
     *
     * @param array<int, array{target_type: string, target_id: string, role: string}> $members
     */
    #[Transactional]
    public function updateCollaboratorRoles(
        CollaborativeResourceAdapterInterface $adapter,
        Authenticatable $authorization,
        string $code,
        array $members
    ): void {
        // 角色变更复用新增流程的校验和双写，但不会新增或删除无关目标。
        $resource = $adapter->getResource($authorization, $code);
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
        $currentOperation = $this->assertManageableAndGetCurrentOperation($adapter, $permissionDataIsolation, $code);
        $projectId = $adapter->getProjectId($resource);
        $ownerId = $adapter->getOwnerId($resource);
        $operationPermissions = $this->normalizeMemberPermissions($permissionDataIsolation, $adapter, $code, $members, true);

        $this->assertProjectBound($projectId);
        $this->validateMemberPermissions($permissionDataIsolation, $operationPermissions, $ownerId, $currentOperation);

        $this->syncProjectMembers(
            $permissionDataIsolation,
            $projectId,
            $operationPermissions
        );
        $this->operationPermissionDomainService->batchUpsertResourceOperations(
            $permissionDataIsolation,
            $adapter->getOperationResourceType(),
            $code,
            $operationPermissions
        );
    }

    /**
     * 将协作者入参归一化为权限实体，并按目标维度去重。
     *
     * @param array<int, array<string, string>> $members
     * @return array<int, OperationPermissionEntity>
     */
    private function normalizeMemberPermissions(
        PermissionDataIsolation $permissionDataIsolation,
        CollaborativeResourceAdapterInterface $adapter,
        string $code,
        array $members,
        bool $requireRole
    ): array {
        $operationPermissions = [];
        foreach ($members as $member) {
            $targetType = (string) ($member['target_type'] ?? '');
            $targetId = (string) ($member['target_id'] ?? '');
            if ($targetType === '' || $targetId === '') {
                ExceptionBuilder::throw(SuperAgentErrorCode::MEMBER_VALIDATION_FAILED, 'project.member_validation_failed');
            }

            $entity = new OperationPermissionEntity();
            $entity->setOrganizationCode($permissionDataIsolation->getCurrentOrganizationCode());
            $entity->setResourceType($adapter->getOperationResourceType());
            $entity->setResourceId($code);
            $entity->setTargetType($this->convertMemberTypeToOperationTargetType(MemberType::fromString($targetType)->value));
            $entity->setTargetId($targetId);
            $entity->setCreator($permissionDataIsolation->getCurrentUserId());
            $entity->setModifier($permissionDataIsolation->getCurrentUserId());

            if ($requireRole) {
                $role = (string) ($member['role'] ?? '');
                $entity->setOperation($this->convertMemberRoleToOperation(MemberRole::validatePermissionLevel($role)->value));
            }

            // 这里按目标去重，避免同一批请求里同一成员重复提交导致双写不一致。
            $operationPermissions[$this->buildOperationPermissionKey($entity)] = $entity;
        }

        return array_values($operationPermissions);
    }

    /**
     * 校验协作者目标是否合法，以及当前操作者是否有权执行本次变更。
     *
     * 这里承载协作角色规则：
     * - 创建人拥有最高权限，可调整协作者角色
     * - 管理员只能邀请或调整为编辑权限，不能操作创建人，也不能移除自己
     * - 可编辑用户不能管理协作者；对应入口会先被 manage 权限拦截
     *
     * @param array<int, OperationPermissionEntity> $operationPermissions
     */
    private function validateMemberPermissions(
        PermissionDataIsolation $permissionDataIsolation,
        array $operationPermissions,
        string $ownerId,
        Operation $currentOperation,
        bool $checkRole = true
    ): void {
        $currentUserId = $permissionDataIsolation->getCurrentUserId();
        $userIds = [];
        $departmentIds = [];
        foreach ($operationPermissions as $operationPermission) {
            $memberType = $this->convertOperationTargetTypeToMemberType($operationPermission->getTargetType());
            if ($memberType === MemberType::USER) {
                $userIds[] = $operationPermission->getTargetId();
            }
            if ($memberType === MemberType::DEPARTMENT) {
                $departmentIds[] = $operationPermission->getTargetId();
            }

            $this->assertCollaboratorTargetOperable($memberType, $operationPermission->getTargetId(), $ownerId, $currentUserId);

            if (! $checkRole) {
                continue;
            }

            $this->assertCollaboratorRoleAssignable($currentOperation, $operationPermission->getOperation());
        }

        $contactDataIsolation = $this->createContactDataIsolationByBase($permissionDataIsolation);
        $userMap = $this->magicUserDomainService->getByUserIds($contactDataIsolation, array_values(array_unique($userIds)));
        foreach ($userIds as $userId) {
            if (! isset($userMap[$userId])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $userId]);
            }
        }

        $departmentMap = $this->magicDepartmentDomainService->getDepartmentByIds(
            $contactDataIsolation,
            array_values(array_unique($departmentIds)),
            true
        );
        foreach ($departmentIds as $departmentId) {
            if (! isset($departmentMap[$departmentId])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $departmentId]);
            }
        }
    }

    /**
     * 校验当前变更目标是否允许被操作。
     *
     * 协作者管理场景下，禁止对创建人做改权或移除，也禁止操作者处理自己。
     */
    private function assertCollaboratorTargetOperable(
        ?MemberType $memberType,
        string $targetId,
        string $ownerId,
        string $currentUserId
    ): void {
        if ($memberType !== MemberType::USER) {
            return;
        }

        if ($targetId === $ownerId || $targetId === $currentUserId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }
    }

    /**
     * 校验当前操作者是否允许授予目标角色。
     *
     * 目前规则是：只有创建人可以授予管理员/查看者等更高或更多样的权限；
     * 非创建人的可管理用户只能授予编辑权限。
     */
    private function assertCollaboratorRoleAssignable(Operation $currentOperation, Operation $targetOperation): void
    {
        if ($currentOperation->isOwner()) {
            return;
        }

        if ($targetOperation !== Operation::Edit) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }
    }

    /**
     * 将协作者变更最小化同步到项目成员表。
     *
     * @param array<int, OperationPermissionEntity> $operationPermissions
     */
    private function syncProjectMembers(
        PermissionDataIsolation $permissionDataIsolation,
        int $projectId,
        array $operationPermissions
    ): void {
        // 项目成员表只承担运行时依赖，因此这里做最小增量同步，不重建整表。
        $targets = $this->extractProjectMemberTargets($operationPermissions);
        $existingMembers = $this->projectMemberDomainService->getMembersByTargets($projectId, $targets);
        $existingMemberMap = [];
        foreach ($existingMembers as $existingMember) {
            $existingMemberMap[$existingMember->getTargetType()->value . '_' . $existingMember->getTargetId()] = $existingMember;
        }

        $newMembers = [];
        $roleUpdates = [];
        foreach ($operationPermissions as $operationPermission) {
            $memberType = $this->convertOperationTargetTypeToMemberType($operationPermission->getTargetType());
            $memberRole = $this->convertOperationToMemberRole($operationPermission->getOperation());
            if ($memberType === null || $memberRole === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::MEMBER_VALIDATION_FAILED, 'project.member_validation_failed');
            }

            $key = $memberType->value . '_' . $operationPermission->getTargetId();
            $existingMember = $existingMemberMap[$key] ?? null;
            if ($existingMember === null) {
                $memberEntity = new ProjectMemberEntity();
                $memberEntity->setProjectId($projectId);
                $memberEntity->setTargetTypeFromString($memberType->value);
                $memberEntity->setTargetId($operationPermission->getTargetId());
                $memberEntity->setRoleFromString($memberRole);
                $memberEntity->setInvitedBy($permissionDataIsolation->getCurrentUserId());
                $memberEntity->setOrganizationCode($permissionDataIsolation->getCurrentOrganizationCode());
                $memberEntity->setJoinMethod(MemberJoinMethod::INTERNAL);
                $newMembers[] = $memberEntity;
                continue;
            }

            if ($existingMember->getRoleValue() !== $memberRole) {
                $roleUpdates[] = [
                    'target_type' => $memberType->value,
                    'target_id' => $operationPermission->getTargetId(),
                    'role' => $memberRole,
                ];
            }
        }

        $this->projectMemberDomainService->addInternalMembers($newMembers, $permissionDataIsolation->getCurrentOrganizationCode());
        $this->projectMemberDomainService->batchUpdateRole($projectId, $roleUpdates);
    }

    /**
     * 从权限实体中提取项目成员表需要的目标维度。
     *
     * @param array<int, OperationPermissionEntity> $operationPermissions
     * @return array<int, array{target_type: string, target_id: string}>
     */
    private function extractProjectMemberTargets(array $operationPermissions): array
    {
        $targets = [];
        foreach ($operationPermissions as $operationPermission) {
            $memberType = $this->convertOperationTargetTypeToMemberType($operationPermission->getTargetType());
            if ($memberType === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::INVALID_MEMBER_TYPE, 'project.invalid_member_type');
            }

            $targets[$memberType->value . '_' . $operationPermission->getTargetId()] = [
                'target_type' => $memberType->value,
                'target_id' => $operationPermission->getTargetId(),
            ];
        }

        return array_values($targets);
    }

    /**
     * 生成权限实体的唯一键，保证批量请求内同一目标只保留一份数据。
     */
    private function buildOperationPermissionKey(OperationPermissionEntity $operationPermission): string
    {
        return $operationPermission->getTargetType()->value . '_' . $operationPermission->getTargetId();
    }

    /**
     * 校验当前用户具备 manage 权限，并返回其当前最高操作权限。
     */
    private function assertManageableAndGetCurrentOperation(
        CollaborativeResourceAdapterInterface $adapter,
        PermissionDataIsolation $permissionDataIsolation,
        string $code
    ): Operation {
        $currentOperation = $this->resourceAccessPolicyService->getCurrentOperation(
            $permissionDataIsolation,
            $adapter->getOperationResourceType(),
            $code
        );
        if ($currentOperation === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        $currentOperation->validate('manage', $code);
        return $currentOperation;
    }

    /**
     * 校验资源已经绑定项目，避免同步项目成员表时写入空项目。
     */
    private function assertProjectBound(int $projectId): void
    {
        if ($projectId > 0) {
            return;
        }

        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
    }

    /**
     * 将项目成员类型转换为权限域目标类型。
     */
    private function convertMemberTypeToOperationTargetType(string $memberType): TargetType
    {
        return match ($memberType) {
            MemberType::USER->value => TargetType::UserId,
            MemberType::DEPARTMENT->value => TargetType::DepartmentId,
            default => ExceptionBuilder::throw(SuperAgentErrorCode::INVALID_MEMBER_TYPE, 'project.invalid_member_type'),
        };
    }

    /**
     * 将权限域目标类型转换为项目成员类型。
     */
    private function convertOperationTargetTypeToMemberType(TargetType $targetType): ?MemberType
    {
        return match ($targetType) {
            TargetType::UserId => MemberType::USER,
            TargetType::DepartmentId => MemberType::DEPARTMENT,
            default => null,
        };
    }

    /**
     * 将协作者角色转换为权限域操作类型。
     */
    private function convertMemberRoleToOperation(string $role): Operation
    {
        return match ($role) {
            MemberRole::OWNER->value => Operation::Owner,
            MemberRole::MANAGE->value => Operation::Admin,
            MemberRole::EDITOR->value => Operation::Edit,
            MemberRole::VIEWER->value => Operation::Read,
            default => ExceptionBuilder::throw(SuperAgentErrorCode::INVALID_MEMBER_ROLE, 'project.invalid_member_role'),
        };
    }

    /**
     * 将权限域操作类型转换回协作者角色。
     */
    private function convertOperationToMemberRole(Operation $operation): ?string
    {
        return match ($operation) {
            Operation::Owner => MemberRole::OWNER->value,
            Operation::Admin => MemberRole::MANAGE->value,
            Operation::Edit => MemberRole::EDITOR->value,
            Operation::Read => MemberRole::VIEWER->value,
            default => null,
        };
    }

    /**
     * 组装协作者列表返回结构，并补齐用户、部门展示字段。
     *
     * @return array{users: array<int, array>, departments: array<int, array>}
     */
    private function buildCollaboratorPayload(
        PermissionDataIsolation $permissionDataIsolation,
        string $code,
        CollaborativeResourceAdapterInterface $adapter
    ): array {
        // 协作者列表主读协作权限表，不再依赖项目成员表回显。
        $collaborators = $this->operationPermissionDomainService->listByResource(
            $permissionDataIsolation,
            $adapter->getOperationResourceType(),
            $code
        );

        $userIds = [];
        $departmentIds = [];
        $items = [];
        foreach ($collaborators as $collaborator) {
            $memberType = $this->convertOperationTargetTypeToMemberType($collaborator->getTargetType());
            $role = $this->convertOperationToMemberRole($collaborator->getOperation());
            if ($memberType === null || $role === null) {
                continue;
            }

            $items[] = [
                'target_type' => $memberType->value,
                'target_id' => $collaborator->getTargetId(),
                'role' => $role,
            ];

            if ($memberType === MemberType::USER) {
                $userIds[] = $collaborator->getTargetId();
            }
            if ($memberType === MemberType::DEPARTMENT) {
                $departmentIds[] = $collaborator->getTargetId();
            }
        }

        $contactDataIsolation = $this->createContactDataIsolationByBase($permissionDataIsolation);
        $userMap = $this->magicUserDomainService->getByUserIds($contactDataIsolation, array_values(array_unique($userIds)));
        $departmentMap = $this->magicDepartmentDomainService->getDepartmentByIds(
            $contactDataIsolation,
            array_values(array_unique($departmentIds)),
            true
        );

        $users = [];
        $departments = [];
        foreach ($items as $item) {
            if ($item['target_type'] === MemberType::USER->value) {
                $user = $userMap[$item['target_id']] ?? null;
                if ($user === null) {
                    continue;
                }
                $users[] = [
                    'id' => $item['target_id'],
                    'user_id' => $item['target_id'],
                    'nickname' => $user->getNickname(),
                    'i18n_name' => $user->getI18nName(),
                    'organization_code' => $user->getOrganizationCode(),
                    'avatar_url' => $user->getAvatarUrl(),
                    'role' => $item['role'],
                    'join_method' => MemberJoinMethod::INTERNAL->value,
                ];
                continue;
            }

            $department = $departmentMap[$item['target_id']] ?? null;
            if ($department === null) {
                continue;
            }
            $departments[] = [
                'id' => $item['target_id'],
                'department_id' => $item['target_id'],
                'name' => $department->getName() ?? '',
                'i18n_name' => $department->getI18nName() ?? '',
                'organization_code' => $department->getOrganizationCode(),
                'role' => $item['role'],
                'join_method' => MemberJoinMethod::INTERNAL->value,
            ];
        }

        usort($users, fn (array $left, array $right) => $this->compareRolePriority($left['role'], $right['role']));
        usort($departments, fn (array $left, array $right) => $this->compareRolePriority($left['role'], $right['role']));

        return [
            'users' => $users,
            'departments' => $departments,
        ];
    }

    /**
     * 定义协作者角色排序优先级，保证列表输出稳定。
     */
    private function compareRolePriority(string $leftRole, string $rightRole): int
    {
        $priority = [
            MemberRole::OWNER->value => 1,
            MemberRole::MANAGE->value => 2,
            MemberRole::EDITOR->value => 3,
            MemberRole::VIEWER->value => 4,
        ];

        return ($priority[$leftRole] ?? 99) <=> ($priority[$rightRole] ?? 99);
    }
}
