<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectMemberEntity;
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
     * 根据用户和部门获取项目ID列表及总数.
     *
     * @param string $userId 用户ID
     * @param array $departmentIds 部门ID数组
     * @param null|string $name 项目名称模糊搜索关键词
     * @return array ['total' => int, 'project_ids' => array]
     */
    public function getProjectIdsByUserAndDepartments(string $userId, array $departmentIds = [], ?string $name = null): array
    {
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
            ->where('magic_super_agent_project.user_id', '!=', $userId)
            ->whereNull('magic_super_agent_project.deleted_at');

        if (! empty($name)) {
            // 如果有项目名称搜索条件，则需要连接项目表
            $query->where('magic_super_agent_project.project_name', 'like', '%' . $name . '%');
        }

        $query->select('magic_super_agent_project_members.project_id')
            ->distinct();

        $results = $query->get()->toArray();

        $projectIds = array_map(fn ($row) => (int) $row['project_id'], $results);

        return [
            'total' => count($projectIds),
            'project_ids' => $projectIds,
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

        $counts = [];

        foreach ($projectIds as $projectId) {
            $totalCount = $this->projectMemberModel::query()
                ->where('project_id', $projectId)
                ->count();

            $counts[$projectId] = $totalCount;
        }

        return $counts;
    }

    /**
     * 批量获取项目前N个成员预览.
     *
     * @param array $projectIds 项目ID数组
     * @param int $limit 限制数量，默认4个
     * @return array [project_id => [['target_type' => '', 'target_id' => ''], ...]]
     */
    public function getProjectMembersPreview(array $projectIds, int $limit = 4): array
    {
        if (empty($projectIds)) {
            return [];
        }

        $preview = [];

        foreach ($projectIds as $projectId) {
            $members = $this->projectMemberModel::query()
                ->where('project_id', $projectId)
                ->orderBy('id', 'asc')
                ->limit($limit)
                ->get()
                ->toArray();

            $preview[$projectId] = array_map(function ($member) {
                return ProjectMemberEntity::modelToEntity($member);
            }, $members);
        }

        return $preview;
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
            'organization_code' => $entity->getOrganizationCode(),
            'status' => $entity->getStatus()->value,
            'invited_by' => $entity->getInvitedBy(),
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
}
