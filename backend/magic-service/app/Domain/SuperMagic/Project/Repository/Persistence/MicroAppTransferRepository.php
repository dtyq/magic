<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Common\Entity\ValueObject\HiddenType;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Repository\Model\ResourceShareModel;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Repository\Model\MicroAppModel;
use App\Domain\SuperMagic\Project\Repository\Model\ProjectModel;
use Hyperf\DbConnection\Db;

/** Lock order is project, app, then its share records for transfer and metadata writes. */
class MicroAppTransferRepository
{
    public function lockProject(int $projectId): ?ProjectEntity
    {
        $model = ProjectModel::query()->where('id', $projectId)->lockForUpdate()->first();
        if ($model === null) {
            return null;
        }
        return self::hydrateProject($model->toArray());
    }

    /** Nullable columns (e.g. project_description) must fall back to entity defaults, not hit strict setters. */
    public static function hydrateProject(array $data): ProjectEntity
    {
        $data = array_filter($data, static fn ($value) => $value !== null);
        $data['default_join_permission'] = MemberRole::fromString(($data['default_join_permission'] ?? '') ?: MemberRole::VIEWER->value);
        return new ProjectEntity($data);
    }

    public function lockAppByProject(int $projectId, string $organizationCode): ?MicroAppEntity
    {
        $model = MicroAppModel::withTrashed()->where('project_id', $projectId)
            ->where('organization_code', $organizationCode)->lockForUpdate()->first();
        return $model === null ? null : new MicroAppEntity($model->toArray());
    }

    public function changeProjectOwner(ProjectEntity $project): void
    {
        // Hydration defaults are for reads; do not persist them over nullable project columns.
        ProjectModel::query()->where('id', $project->getId())
            ->where('user_organization_code', $project->getUserOrganizationCode())
            ->update([
                'user_id' => $project->getUserId(),
                'workspace_id' => $project->getWorkspaceId(),
                'updated_at' => $project->getUpdatedAt(),
            ]);
    }

    public function changeAppOwner(MicroAppEntity $app, string $receiverId): void
    {
        MicroAppModel::withTrashed()->where('id', $app->getId())
            ->where('organization_code', $app->getOrganizationCode())
            ->update(['user_id' => $receiverId, 'updated_at' => date('Y-m-d H:i:s')]);
        // Keep URLs, access rules, passwords and historical authorship intact. The changed
        // created_uid also changes AccessTokenUtil's security fingerprint and revokes old tokens.
        $shares = ResourceShareModel::withTrashed()->where('organization_code', $app->getOrganizationCode())
            ->where('resource_type', ResourceType::Project->value)->where('resource_id', $app->getResourceId());
        $ids = (clone $shares)->lockForUpdate()->pluck('id')->all();
        if ($ids !== []) {
            $shares->whereIn('id', $ids)->update([
                'created_uid' => $receiverId, 'updated_uid' => $receiverId,
                'scope_version' => Db::raw('scope_version + 1'), 'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }
    }

    /** Keep the operator audit separate from the stable link owner after delegated management. */
    public function recordShareOperator(MicroAppEntity $app, string $operatorId): void
    {
        ResourceShareModel::withTrashed()->where('organization_code', $app->getOrganizationCode())
            ->where('resource_type', ResourceType::Project->value)->where('resource_id', $app->getResourceId())
            ->update(['updated_uid' => $operatorId]);
    }

    public function hasMicroAppsInWorkspace(int $workspaceId): bool
    {
        return ProjectModel::query()->where('workspace_id', $workspaceId)
            ->where(function ($query): void {
                $query->where('project_mode', ProjectMode::MICRO_APP->value)
                    ->orWhere('hidden_type', HiddenType::MICRO_APP_RUNTIME->value)
                    ->orWhereExists(function ($apps): void {
                        $apps->select(Db::raw('1'))->from('magic_super_agent_micro_apps as ma')
                            ->whereColumn('ma.project_id', 'magic_super_agent_project.id');
                    });
            })->exists();
    }
}
