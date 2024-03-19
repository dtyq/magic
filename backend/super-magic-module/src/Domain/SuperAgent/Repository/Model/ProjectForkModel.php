<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * Project fork model.
 */
class ProjectForkModel extends AbstractModel
{
    /**
     * Table name.
     */
    protected ?string $table = 'magic_super_agent_project_fork';

    /**
     * Fillable fields.
     */
    protected array $fillable = [
        'id',
        'source_project_id',
        'fork_project_id',
        'target_workspace_id',
        'user_id',
        'user_organization_code',
        'status',
        'progress',
        'current_file_id',
        'total_files',
        'processed_files',
        'err_msg',
        'created_uid',
        'updated_uid',
    ];

    /**
     * Field type casts.
     */
    protected array $casts = [
        'id' => 'integer',
        'source_project_id' => 'integer',
        'fork_project_id' => 'integer',
        'target_workspace_id' => 'integer',
        'progress' => 'integer',
        'current_file_id' => 'integer',
        'total_files' => 'integer',
        'processed_files' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the source project that this fork belongs to.
     */
    public function sourceProject()
    {
        return $this->belongsTo(ProjectModel::class, 'source_project_id', 'id');
    }

    /**
     * Get the forked project.
     */
    public function forkProject()
    {
        return $this->belongsTo(ProjectModel::class, 'fork_project_id', 'id');
    }

    /**
     * Get the target workspace.
     */
    public function targetWorkspace()
    {
        return $this->belongsTo(WorkspaceModel::class, 'target_workspace_id', 'id');
    }
}
