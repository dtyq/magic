<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * 项目成员模型.
 */
class ProjectMemberModel extends AbstractModel
{
    protected ?string $table = 'magic_super_agent_project_members';

    protected array $fillable = [
        'id',
        'project_id',
        'target_type',
        'target_id',
        'role',
        'organization_code',
        'status',
        'invited_by',
        'created_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'project_id' => 'integer',
        'status' => 'integer',
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
