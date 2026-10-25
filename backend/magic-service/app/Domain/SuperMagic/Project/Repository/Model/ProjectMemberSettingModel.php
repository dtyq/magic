<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * 项目成员设置模型.
 */
class ProjectMemberSettingModel extends AbstractModel
{
    protected ?string $table = 'magic_super_agent_project_member_settings';

    protected array $fillable = [
        'id',
        'user_id',
        'project_id',
        'organization_code',
        'is_pinned',
        'pinned_at',
        'sort_order',
        'pinned_sort_order',
        'is_bind_workspace',
        'bind_workspace_id',
        'last_active_at',
        'created_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'project_id' => 'integer',
        'is_pinned' => 'boolean',
        'pinned_at' => 'datetime',
        'sort_order' => 'integer',
        'pinned_sort_order' => 'integer',
        'is_bind_workspace' => 'boolean',
        'bind_workspace_id' => 'integer',
        'last_active_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * 所属项目.
     */
    public function project()
    {
        return $this->belongsTo(ProjectModel::class, 'project_id', 'id');
    }
}
