<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberType;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectMemberRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\ProjectMemberModel;
use Hyperf\DbConnection\Db;

/**
 * 项目成员仓储实现.
 *
 * 负责项目成员的数据持久化操作
 */
class ProjectMemberRepository implements ProjectMemberRepositoryInterface
{
    public function __construct(
        private readonly ProjectMemberModel $projectMemberModel
    ) {
    }

    /**
     * 批量插入项目成员.
     */
    public function insert(array $projectMemberEntities): void
    {
        if (empty($projectMemberEntities)) {
            return;
        }

        $attributes = $this->prepareBatchInsertAttributes($projectMemberEntities);

        // 使用事务确保数据一致性
        Db::transaction(function () use ($attributes) {
            // 分批插入，避免单次插入数据过多
            $chunks = array_chunk($attributes, 100);
            foreach ($chunks as $chunk) {
                $this->projectMemberModel::query()->insert($chunk);
            }
        });
    }

    /**
     * 根据项目ID删除所有成员.
     */
    public function deleteByProjectId(int $projectId): int
    {
        return $this->projectMemberModel::query()
            ->where('project_id', $projectId)
            ->delete();
    }

    /**
     * 根据ID数组批量删除成员.
     */
    public function deleteByIds(array $ids): int
    {
        if (empty($ids)) {
            return 0;
        }

        return $this->projectMemberModel::query()
            ->whereIn('id', $ids)
            ->delete();
    }

    /**
     * 检查项目和用户的成员关系是否存在.
     */
    public function existsByProjectAndUser(int $projectId, string $userId): bool
    {
        return $this->projectMemberModel::query()
            ->where('project_id', $projectId)
            ->where('target_type', MemberType::USER->value)
            ->where('target_id', $userId)
            ->exists();
    }

    /**
     * 检查项目和部门列表的成员关系是否存在.
     */
    public function existsByProjectAndDepartments(int $projectId, array $departmentIds): bool
    {
        if (empty($departmentIds)) {
            return false;
        }

        return $this->projectMemberModel::query()
            ->where('project_id', $projectId)
            ->where('target_type', MemberType::DEPARTMENT->value)
            ->whereIn('target_id', $departmentIds)
            ->exists();
    }

    /**
     * 根据项目ID获取所有项目成员.
     *
     * @param int $projectId 项目ID
     * @return ProjectMemberEntity[] 项目成员实体数组
     */
    public function findByProjectId(int $projectId): array
    {
        $results = $this->projectMemberModel::query()
            ->where('project_id', $projectId)
            ->orderBy('id', 'asc')
            ->get()
            ->toArray();

        $entities = [];
        foreach ($results as $row) {
            $entities[] = ProjectMemberEntity::modelToEntity($row);
        }

        return $entities;
    }

    /**
     * 根据用户和部门获取项目ID列表及总数（支持置顶排序）.
     */
    public function getProjectIdsByUserAndDepartments(
        string $userId,
        array $departmentIds = [],
        ?string $name = null,
        ?string $sortField = null,
        string $sortDirection = 'desc',
        array $creatorUserIds = []
    ): array {
        $query = $this->projectMemberModel::query()
            ->where(function ($query) use ($userId, $departmentIds) {
                $query->where(function ($subQuery) use ($userId) {
                    $subQuery->where('target_type', MemberType::USER->value)
                        ->where('target_id', $userId);
                });

                if (! empty($departmentIds)) {
                    $query->orWhere(function ($subQuery) use ($departmentIds) {
                        $subQuery->where('target_type', MemberType::DEPARTMENT->value)
                            ->whereIn('target_id', $departmentIds);
                    });
                }
            });

        $query->join('magic_super_agent_project', 'magic_super_agent_project_members.project_id', '=', 'magic_super_agent_project.id')
            ->leftJoin('magic_super_agent_project_member_settings', function ($join) use ($userId) {
                $join->on('magic_super_agent_project_member_settings.project_id', '=', 'magic_super_agent_project.id')
                    ->where('magic_super_agent_project_member_settings.user_id', '=', $userId);
            })
            ->where('magic_super_agent_project.user_id', '!=', $userId)
            ->whereNull('magic_super_agent_project.deleted_at');

        if (! empty($name)) {
            // 如果有项目名称搜索条件，则需要连接项目表
            $query->where('magic_super_agent_project.project_name', 'like', '%' . $name . '%');
        }

        if (! empty($creatorUserIds)) {
            // 如果有创建者用户ID搜索条件
            $query->whereIn('magic_super_agent_project.user_id', $creatorUserIds);
        }

        $query->select(
            'magic_super_agent_project_members.project_id',
            'magic_super_agent_project.updated_at',
            'magic_super_agent_project.created_at',
            'magic_super_agent_project_member_settings.is_pinned',
            'magic_super_agent_project_member_settings.last_active_at',
            'magic_super_agent_project_member_settings.is_bind_workspace',
            'magic_super_agent_project_member_settings.bind_workspace_id'
        )
            ->distinct()
            ->orderByRaw('COALESCE(magic_super_agent_project_member_settings.is_pinned, 0) DESC'); // 置顶的在前

        // 根据排序字段进行排序（默认按 updated_at 排序）
        $effectiveSortField = $sortField ?: 'updated_at';
        $effectiveSortDirection = $sortDirection ?: 'desc';

        switch ($effectiveSortField) {
            case 'updated_at':
                $query->orderBy('magic_super_agent_project.updated_at', $effectiveSortDirection);
                break;
            case 'created_at':
                $query->orderBy('magic_super_agent_project.created_at', $effectiveSortDirection);
                break;
            case 'last_active_at':
                $query->orderBy('magic_super_agent_project_member_settings.last_active_at', $effectiveSortDirection);
                break;
            default:
                $query->orderBy('magic_super_agent_project.updated_at', 'desc');
                break;
        }

        $results = $query->get()->toArray();

        return [
            'total' => count($results),
            'list' => $results,
        ];
    }

    /**
     * 批量获取项目成员总数.
     *
     * @param array $projectIds 项目ID数组
     * @return array [project_id => total_count]
     */
    public function getProjectMembersCounts(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        // 使用单次查询优化N+1问题
        $results = $this->projectMemberModel::query()
            ->whereIn('project_id', $projectIds)
            ->whereIn('role', [MemberRole::EDITOR->value, MemberRole::VIEWER->value])
            ->groupBy('project_id')
            ->selectRaw('project_id, COUNT(*) as total_count')
            ->get()
            ->keyBy('project_id')
            ->toArray();

        // 确保所有项目ID都有返回值，没有成员的项目返回0
        $counts = [];
        foreach ($projectIds as $projectId) {
            $counts[$projectId] = (int) ($results[$projectId]['total_count'] ?? 0);
        }

        return $counts;
    }

    /**
     * 批量获取项目前N个成员预览.
     *
     * @param array $projectIds 项目ID数组
     * @param int $limit 限制数量，默认4个
     * @return array [project_id => [ProjectMemberEntity[], ...]]
     */
    public function getProjectMembersPreview(array $projectIds, int $limit = 4): array
    {
        if (empty($projectIds)) {
            return [];
        }

        // 使用Eloquent查询，批量获取所有相关项目的成员
        $results = $this->projectMemberModel::query()
            ->whereIn('project_id', $projectIds)
            ->orderBy('id', 'asc')
            ->get()
            ->toArray();

        // 初始化结果数组
        $preview = [];
        foreach ($projectIds as $projectId) {
            $preview[$projectId] = [];
        }

        // 按项目分组并限制每个项目的成员数量
        $memberCounts = [];
        foreach ($results as $member) {
            $projectId = $member['project_id'];

            // 初始化计数器
            if (! isset($memberCounts[$projectId])) {
                $memberCounts[$projectId] = 0;
            }

            // 如果未达到限制数量，则添加到结果中
            if ($memberCounts[$projectId] < $limit) {
                $preview[$projectId][] = ProjectMemberEntity::modelToEntity($member);
                ++$memberCounts[$projectId];
            }
        }

        return $preview;
    }

    /**
     * 获取用户创建的且有成员的项目ID列表及总数（支持置顶排序）.
     */
    public function getSharedProjectIdsByUser(
        string $userId,
        string $organizationCode,
        ?string $name = null,
        int $page = 1,
        int $pageSize = 10,
        ?string $sortField = null,
        string $sortDirection = 'desc',
        array $creatorUserIds = []
    ): array {
        // 构建基础查询：查找用户创建的且有成员的项目
        $query = $this->projectMemberModel::query()
            ->join('magic_super_agent_project', 'magic_super_agent_project_members.project_id', '=', 'magic_super_agent_project.id')
            ->leftJoin('magic_super_agent_project_member_settings', function ($join) use ($userId) {
                $join->on('magic_super_agent_project_member_settings.project_id', '=', 'magic_super_agent_project.id')
                    ->where('magic_super_agent_project_member_settings.user_id', '=', $userId);
            })
            ->whereIn('magic_super_agent_project_members.role', [MemberRole::EDITOR->value, MemberRole::VIEWER->value])
            ->where('magic_super_agent_project.user_id', '=', $userId)
            ->where('magic_super_agent_project.user_organization_code', '=', $organizationCode)
            ->whereNull('magic_super_agent_project.deleted_at');

        // 如果有项目名称搜索条件
        if (! empty($name)) {
            $query->where('magic_super_agent_project.project_name', 'like', '%' . $name . '%');
        }

        // 如果有创建者用户ID搜索条件（对于shared类型，通常是当前用户创建的项目，这里主要是为了接口一致性）
        if (! empty($creatorUserIds)) {
            $query->whereIn('magic_super_agent_project.user_id', $creatorUserIds);
        }

        // 获取总数
        $totalQuery = clone $query;
        $total = $totalQuery->select('magic_super_agent_project_members.project_id')->distinct()->count();

        // 分页查询项目ID（包含排序字段以兼容DISTINCT）
        $projects = $query->select(
            'magic_super_agent_project_members.project_id',
            'magic_super_agent_project.updated_at',
            'magic_super_agent_project.created_at',
            'magic_super_agent_project_member_settings.is_pinned',
            'magic_super_agent_project_member_settings.last_active_at',
            'magic_super_agent_project_member_settings.is_bind_workspace',
            'magic_super_agent_project_member_settings.bind_workspace_id'
        )
            ->distinct()
            ->orderByRaw('COALESCE(magic_super_agent_project_member_settings.is_pinned, 0) DESC'); // 置顶的在前

        // 根据排序字段进行排序（默认按 updated_at 排序）
        $effectiveSortField = $sortField ?: 'updated_at';
        $effectiveSortDirection = $sortDirection ?: 'desc';

        switch ($effectiveSortField) {
            case 'updated_at':
                $projects->orderBy('magic_super_agent_project.updated_at', $effectiveSortDirection);
                break;
            case 'created_at':
                $projects->orderBy('magic_super_agent_project.created_at', $effectiveSortDirection);
                break;
            case 'last_active_at':
                $projects->orderBy('magic_super_agent_project_member_settings.last_active_at', $effectiveSortDirection);
                break;
            default:
                $projects->orderBy('magic_super_agent_project.updated_at', 'desc');
                break;
        }

        $projects = $projects->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get()
            ->toArray();

        return [
            'total' => $total,
            'list' => $projects,
        ];
    }

    /**
     * 获取协作项目的创建者用户ID列表.
     */
    public function getCollaborationProjectCreatorIds(
        string $userId,
        array $departmentIds,
        string $organizationCode
    ): array {
        $query = $this->projectMemberModel::query()
            ->leftJoin('magic_super_agent_project as projects', 'magic_super_agent_project_members.project_id', '=', 'projects.id')
            ->where('magic_super_agent_project_members.organization_code', $organizationCode);

        // 构建用户权限查询条件 - 用户是项目成员或部门成员
        $query->where(function ($q) use ($userId, $departmentIds) {
            $q->where(function ($userQuery) use ($userId) {
                $userQuery->where('magic_super_agent_project_members.target_type', 'User')
                    ->where('magic_super_agent_project_members.target_id', $userId);
            });

            if (! empty($departmentIds)) {
                $q->orWhere(function ($deptQuery) use ($departmentIds) {
                    $deptQuery->where('magic_super_agent_project_members.target_type', 'Department')
                        ->whereIn('magic_super_agent_project_members.target_id', $departmentIds);
                });
            }
        });

        // 只获取状态正常的项目成员
        $query->where('magic_super_agent_project_members.status', '1');

        // 按创建者ID分组去重，获取不重复的创建者ID列表
        $creatorIds = $query->select('projects.user_id')
            ->whereNotNull('projects.user_id')
            ->groupBy('projects.user_id')
            ->pluck('projects.user_id')
            ->toArray();

        return array_filter($creatorIds); // 过滤空值
    }

    /**
     * 获取用户参与的项目列表（支持协作项目筛选和工作区绑定筛选）.
     */
    public function getParticipatedProjects(
        string $userId,
        ?int $workspaceId,
        bool $showCollaboration = true,
        ?string $projectName = null,
        int $page = 1,
        int $pageSize = 10,
        string $sortField = 'last_active_at',
        string $sortDirection = 'desc'
    ): array {
        // 构建基础查询
        $query = $this->projectMemberModel::query()
            ->from('magic_super_agent_project_members as pm')
            ->join('magic_super_agent_project as p', 'pm.project_id', '=', 'p.id')
            ->leftJoin('magic_super_agent_project_member_settings as pms', function ($join) use ($userId) {
                $join->on('p.id', '=', 'pms.project_id')
                    ->where('pms.user_id', '=', $userId);
            })
            ->where('pm.target_type', MemberType::USER->value)
            ->where('pm.target_id', $userId)
            ->where('pm.status', 1)
            ->where('p.project_status', 1) // 只查询激活状态的项目
            ->whereNull('p.deleted_at');

        // 工作区限制（可选）
        if ($workspaceId !== null) {
            $query->where(function ($subQuery) use ($workspaceId, $userId) {
                $subQuery
                    // 情况1：用户自己创建的项目，在指定工作区
                    ->where(function ($q) use ($workspaceId, $userId) {
                        $q->where('p.user_id', $userId)
                            ->where('p.workspace_id', $workspaceId);
                    })
                    // 情况2：协作项目，用户绑定到指定工作区
                    ->orWhere(function ($q) use ($workspaceId, $userId) {
                        $q->where('p.user_id', '!=', $userId)
                            ->where('pms.is_bind_workspace', 1)
                            ->where('pms.bind_workspace_id', $workspaceId);
                    });
            });
        }

        // 项目名称模糊搜索
        if (! empty($projectName)) {
            $query->where('p.project_name', 'like', '%' . $projectName . '%');
        }

        // 协作项目筛选逻辑
        if (! $showCollaboration) {
            // showCollaboration = 0 时，只显示已设置快捷方式的项目
            $query->where('pms.is_bind_workspace', 1);

            // 如果指定了工作区，则进一步限制为绑定到该工作区的项目
            if ($workspaceId !== null) {
                $query->where('pms.bind_workspace_id', $workspaceId);
            }
        }
        // showCollaboration = 1 时，显示所有参与的项目（默认情况）

        // 获取总数
        $totalQuery = clone $query;
        $total = $totalQuery->select('p.id')->distinct()->count();

        // 构建查询字段
        $query->select([
            'p.id',
            'p.workspace_id',
            'p.project_name',
            'p.project_description',
            'p.work_dir',
            'p.current_topic_id',
            'p.current_topic_status',
            'p.project_status',
            'p.project_mode',
            'p.user_id',
            'p.user_organization_code as organization_code',
            'p.created_at',
            'p.updated_at',
            'pm.role as user_role',
            Db::raw('COALESCE(pms.is_pinned, 0) as is_pinned'),
            Db::raw('COALESCE(pms.is_bind_workspace, 0) as is_bind_workspace'),
            Db::raw('COALESCE(pms.bind_workspace_id, 0) as bind_workspace_id'),
            Db::raw('COALESCE(pms.last_active_at, p.created_at) as last_active_at'),
            'pms.pinned_at',
            Db::raw('CASE WHEN p.user_id != ? THEN 1 ELSE 0 END as is_collaborator'),
        ])
            ->addBinding($userId, 'select');

        // 去重
        $query->distinct();

        // 排序逻辑：置顶优先，置顶项目按置顶时间排序，最后按活跃时间排序
        $query->orderByRaw('COALESCE(pms.is_pinned, 0) DESC'); // 1. 置顶的在前
        $query->orderByRaw('pms.pinned_at DESC'); // 2. 置顶项目按置顶时间排序（最后置顶的在前）
        $query->orderByRaw('COALESCE(pms.last_active_at, p.created_at) DESC'); // 3. 按活跃时间排序

        // 分页
        $offset = ($page - 1) * $pageSize;
        $projects = $query->offset($offset)
            ->limit($pageSize)
            ->get()
            ->toArray();

        return [
            'total' => $total,
            'list' => $projects,
        ];
    }

    /**
     * 准备批量插入的属性数组.
     */
    private function prepareBatchInsertAttributes(array $projectMemberEntities): array
    {
        $attributes = [];

        foreach ($projectMemberEntities as $entity) {
            $memberAttrs = $this->entityToModelAttributes($entity);

            if ($entity->getId() === 0) {
                $snowId = IdGenerator::getSnowId();
                $memberAttrs['id'] = $snowId;
                $entity->setId($snowId);
            }

            $attributes[] = $memberAttrs;
        }

        return $attributes;
    }

    /**
     * 实体转换为模型属性.
     */
    private function entityToModelAttributes(ProjectMemberEntity $entity): array
    {
        $now = date('Y-m-d H:i:s');

        return [
            'id' => $entity->getId(),
            'project_id' => $entity->getProjectId(),
            'target_type' => $entity->getTargetType()->value,
            'target_id' => $entity->getTargetId(),
            'role' => $entity->getRole()->value,
            'organization_code' => $entity->getOrganizationCode(),
            'status' => $entity->getStatus()->value,
            'invited_by' => $entity->getInvitedBy(),
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
}
