<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppListScope;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppPublishStatus;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectStatus;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Model\MicroAppModel;
use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;
use RuntimeException;

class MicroAppRepository implements MicroAppRepositoryInterface
{
    public function findById(int $id): ?MicroAppEntity
    {
        $model = MicroAppModel::query()
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        return $model instanceof MicroAppModel ? $this->toEntity($model) : null;
    }

    public function findByIdWithTrashed(int $id): ?MicroAppEntity
    {
        $model = MicroAppModel::withTrashed()
            ->where('id', $id)
            ->first();

        return $model instanceof MicroAppModel ? $this->toEntity($model) : null;
    }

    public function findByResourceIdWithTrashed(string $resourceId): ?MicroAppEntity
    {
        $model = MicroAppModel::withTrashed()->where('resource_id', $resourceId)->first();

        return $model instanceof MicroAppModel ? $this->toEntity($model) : null;
    }

    public function findByProjectId(int $projectId): ?MicroAppEntity
    {
        $model = MicroAppModel::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at')
            ->first();

        return $model instanceof MicroAppModel ? $this->toEntity($model) : null;
    }

    public function findByProjectIdWithTrashed(int $projectId): ?MicroAppEntity
    {
        $model = MicroAppModel::withTrashed()
            ->where('project_id', $projectId)
            ->first();

        return $model instanceof MicroAppModel ? $this->toEntity($model) : null;
    }

    public function ensureByProjectId(
        int $projectId,
        string $organizationCode,
        string $userId,
        string $creatorId
    ): MicroAppEntity {
        $existing = $this->findByProjectId($projectId);
        if ($existing !== null) {
            return $existing;
        }

        $now = date('Y-m-d H:i:s');
        MicroAppModel::query()->insertOrIgnore([
            'id' => IdGenerator::getSnowId(),
            'project_id' => $projectId,
            'resource_id' => (string) IdGenerator::getSnowId(),
            'share_id' => null,
            'share_code' => null,
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'creator_id' => $creatorId,
            'cover_file_key' => null,
            'share_type' => 0,
            'share_range' => null,
            'target_ids' => json_encode([], JSON_UNESCAPED_UNICODE),
            'publish_status' => MicroAppPublishStatus::Unpublished->value,
            'access_url' => '',
            'published_at' => null,
            'unpublished_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $record = $this->findByProjectId($projectId);
        if ($record === null) {
            throw new RuntimeException(sprintf(
                'Failed to create micro app record for project %d',
                $projectId
            ));
        }

        return $record;
    }

    public function save(MicroAppEntity $entity): MicroAppEntity
    {
        $now = date('Y-m-d H:i:s');
        $data = $entity->toArray();
        unset($data['deleted_at']);
        $data['updated_at'] = $now;

        if ($entity->getId() > 0) {
            $data['target_ids'] = json_encode($entity->getTargetIds(), JSON_UNESCAPED_UNICODE);
            MicroAppModel::query()
                ->where('id', $entity->getId())
                ->update($data);
            return $entity->setUpdatedAt($now);
        }

        $data['id'] = IdGenerator::getSnowId();
        $data['created_at'] = $now;
        $model = new MicroAppModel();
        $model->fill($data);
        $model->save();

        return $this->toEntity($model);
    }

    public function deleteByProjectId(int $projectId): bool
    {
        $now = date('Y-m-d H:i:s');

        return MicroAppModel::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at')
            ->update([
                'publish_status' => MicroAppPublishStatus::Unpublished->value,
                'unpublished_at' => $now,
                'updated_at' => $now,
                'deleted_at' => $now,
            ]) > 0;
    }

    public function restoreByProjectId(int $projectId): bool
    {
        return MicroAppModel::withTrashed()
            ->where('project_id', $projectId)
            ->whereNotNull('deleted_at')
            ->update([
                'publish_status' => MicroAppPublishStatus::Unpublished->value,
                'deleted_at' => null,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    public function restoreById(int $id): bool
    {
        return MicroAppModel::withTrashed()
            ->where('id', $id)
            ->whereNotNull('deleted_at')
            ->update([
                'publish_status' => MicroAppPublishStatus::Unpublished->value,
                'deleted_at' => null,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    public function forceDeleteById(int $id): bool
    {
        $model = MicroAppModel::withTrashed()->where('id', $id)->first();
        if (! $model instanceof MicroAppModel) {
            return true;
        }

        return (bool) $model->forceDelete();
    }

    public function countActiveByOrganization(string $organizationCode): int
    {
        return (int) Db::table('magic_super_agent_project as p')
            ->join('magic_super_agent_workspaces as w', 'w.id', '=', 'p.workspace_id')
            ->where('p.user_organization_code', $organizationCode)
            ->where('w.user_organization_code', $organizationCode)
            ->where('w.workspace_type', WorkspaceType::MicroApp->value)
            ->where('p.project_status', ProjectStatus::ACTIVE->value)
            ->whereNull('p.deleted_at')
            ->whereNull('w.deleted_at')
            ->count('p.id');
    }

    public function findPublishedByOrganization(string $organizationCode): array
    {
        $models = MicroAppModel::query()
            ->where('organization_code', $organizationCode)
            ->where('publish_status', MicroAppPublishStatus::Published->value)
            ->whereNull('deleted_at')
            ->orderBy('published_at', 'desc')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            if ($model instanceof MicroAppModel) {
                $entities[] = $this->toEntity($model);
            }
        }

        return $entities;
    }

    public function paginateAccessible(
        string $userId,
        array $departmentIds,
        array $organizationCodes,
        MicroAppListScope $scope,
        string $keyword,
        int $page,
        int $pageSize,
        bool $publishedOnly = false,
        bool $mentionableOnly = false,
    ): array {
        if ($organizationCodes === []) {
            return ['total' => 0, 'list' => []];
        }

        $query = Db::table('magic_super_agent_micro_apps as ma')
            ->join('magic_super_agent_project as p', 'p.id', '=', 'ma.project_id')
            ->whereIn('p.user_organization_code', array_values(array_unique($organizationCodes)))
            ->where('p.project_status', 1)
            ->where('p.is_hidden', 0)
            ->whereNull('ma.deleted_at')
            ->whereNull('p.deleted_at');
        if ($publishedOnly) {
            $query->where('ma.publish_status', MicroAppPublishStatus::Published->value);
        }
        if ($mentionableOnly) {
            // Drafts are executable only for the owner or edit-capable collaborators.
            // Published apps remain mentionable for the existing viewer-access path.
            $query->where(function ($mentionQuery) use ($userId, $departmentIds): void {
                $mentionQuery->where('ma.publish_status', MicroAppPublishStatus::Published->value)
                    ->orWhere(function ($draftQuery) use ($userId, $departmentIds): void {
                        $draftQuery
                            ->where('ma.publish_status', MicroAppPublishStatus::Unpublished->value)
                            ->where(function ($editorQuery) use ($userId, $departmentIds): void {
                                $editorQuery->where('p.user_id', $userId);
                                $editorQuery->orWhere(function ($memberQuery) use ($userId, $departmentIds): void {
                                    $memberQuery
                                        ->where('p.user_id', '<>', $userId)
                                        ->where('p.is_collaboration_enabled', 1)
                                        ->whereExists(function ($roleQuery) use ($userId, $departmentIds): void {
                                            $roleQuery
                                                ->select(Db::raw('1'))
                                                ->from('magic_super_agent_project_members as draft_pm')
                                                ->whereColumn('draft_pm.project_id', 'p.id')
                                                ->where('draft_pm.status', 1)
                                                ->whereNull('draft_pm.deleted_at')
                                                ->whereIn('draft_pm.role', ['manage', 'editor'])
                                                ->where(function ($targetQuery) use ($userId, $departmentIds): void {
                                                    $targetQuery
                                                        ->where(function ($userQuery) use ($userId): void {
                                                            $userQuery
                                                                ->where('draft_pm.target_type', 'User')
                                                                ->where('draft_pm.target_id', $userId);
                                                        });
                                                    if ($departmentIds !== []) {
                                                        $targetQuery->orWhere(function ($departmentQuery) use ($departmentIds): void {
                                                            $departmentQuery
                                                                ->where('draft_pm.target_type', 'Department')
                                                                ->whereIn('draft_pm.target_id', $departmentIds);
                                                        });
                                                    }
                                                });
                                        });
                                });
                            });
                    });
            });
        }
        $query = $query
            ->where(function ($accessQuery) use ($userId, $departmentIds): void {
                $accessQuery->where('p.user_id', $userId);

                $accessQuery->orWhere(function ($collaborationQuery) use ($userId, $departmentIds): void {
                    $collaborationQuery
                        ->where('p.user_id', '<>', $userId)
                        ->where('p.is_collaboration_enabled', 1)
                        ->whereExists(function ($memberQuery) use ($userId, $departmentIds): void {
                            $memberQuery
                                ->select(Db::raw('1'))
                                ->from('magic_super_agent_project_members as pm')
                                ->whereColumn('pm.project_id', 'p.id')
                                ->where('pm.status', 1)
                                ->whereNull('pm.deleted_at')
                                ->whereIn('pm.role', ['manage', 'editor', 'viewer'])
                                ->where(function ($targetQuery) use ($userId, $departmentIds): void {
                                    $targetQuery
                                        ->where(function ($userQuery) use ($userId): void {
                                            $userQuery
                                                ->where('pm.target_type', 'User')
                                                ->where('pm.target_id', $userId);
                                        });

                                    if ($departmentIds !== []) {
                                        $targetQuery->orWhere(function ($departmentQuery) use ($departmentIds): void {
                                            $departmentQuery
                                                ->where('pm.target_type', 'Department')
                                                ->whereIn('pm.target_id', $departmentIds);
                                        });
                                    }
                                });
                        });
                });
            });

        if ($scope === MicroAppListScope::Recent) {
            $query->join('magic_super_agent_micro_app_visits as mav', function ($join) use ($userId, $organizationCodes): void {
                $join->on('mav.micro_app_id', '=', 'ma.id')
                    ->where('mav.user_id', $userId)
                    ->whereIn('mav.organization_code', $organizationCodes);
            });
        }

        if ($keyword !== '') {
            $query->where('p.project_name', 'like', '%' . $keyword . '%');
        }

        switch ($scope) {
            case MicroAppListScope::Created:
                $query->where('p.user_id', $userId);
                break;
            case MicroAppListScope::Collaborated:
                $query
                    ->where('p.user_id', '<>', $userId);
                break;
            case MicroAppListScope::Recent:
                break;
        }

        $total = (clone $query)->count('ma.id');
        $query = $query->select([
            'ma.id as app_id',
            'p.id as project_id',
            'p.project_name as app_name',
            'p.project_description as app_description',
            'ma.creator_id',
            'ma.cover_file_key',
            'ma.publish_status',
            'p.updated_at',
            'p.user_id as project_owner_id',
            'p.user_organization_code as organization_code',
        ]);

        if ($scope === MicroAppListScope::Recent) {
            $query = $query->addSelect('mav.last_visited_at')
                ->orderBy('mav.last_visited_at', 'desc')
                ->orderBy('ma.id', 'desc');
        } else {
            $query = $query->orderBy('p.updated_at', 'desc')->orderBy('ma.id', 'desc');
        }

        $rows = $query
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get()
            ->map(static fn ($row): array => (array) $row)
            ->all();

        return ['total' => (int) $total, 'list' => $rows];
    }

    private function toEntity(MicroAppModel $model): MicroAppEntity
    {
        $data = $model->toArray();
        $data['target_ids'] = is_array($data['target_ids'] ?? null) ? $data['target_ids'] : [];

        return new MicroAppEntity($data);
    }
}
