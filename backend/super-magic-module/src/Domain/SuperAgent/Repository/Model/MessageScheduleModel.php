<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

/**
 * Message schedule model.
 */
class MessageScheduleModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * Soft delete field.
     */
    public const DELETED_AT = 'deleted_at';

    /**
     * Table name.
     */
    protected ?string $table = 'magic_super_agent_message_scheduled';

    /**
     * Fillable fields.
     */
    protected array $fillable = [
        'id',
        'user_id',
        'organization_code',
        'task_name',
        'message_type',
        'message_content',
        'workspace_id',
        'project_id',
        'topic_id',
        'completed',
        'enabled',
        'deadline',
        'remark',
        'time_config',
        'plugins',
        'task_scheduler_crontab_id',
        'created_uid',
        'updated_uid',
    ];

    /**
     * Field type casting.
     */
    protected array $casts = [
        'id' => 'integer',
        'workspace_id' => 'integer',
        'project_id' => 'integer',
        'topic_id' => 'integer',
        'completed' => 'integer',
        'enabled' => 'integer',
        'deadline' => 'datetime',
        'task_scheduler_crontab_id' => 'integer',
        'message_content' => 'array',
        'time_config' => 'array',
        'plugins' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Get the workspace that owns the message schedule.
     */
    public function workspace()
    {
        return $this->belongsTo(WorkspaceModel::class, 'workspace_id', 'id');
    }

    /**
     * Get the project that owns the message schedule.
     */
    public function project()
    {
        return $this->belongsTo(ProjectModel::class, 'project_id', 'id');
    }

    /**
     * Get the topic that owns the message schedule.
     */
    public function topic()
    {
        return $this->belongsTo(TopicModel::class, 'topic_id', 'id');
    }
}
