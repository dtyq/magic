<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * Message schedule log model.
 */
class MessageScheduleLogModel extends AbstractModel
{
    /**
     * Execution status constants.
     */
    public const STATUS_SUCCESS = 1;

    public const STATUS_FAILED = 2;

    public const STATUS_RUNNING = 3;

    /**
     * Table name.
     */
    protected ?string $table = 'magic_super_agent_message_schedule_log';

    /**
     * Fillable fields.
     */
    protected array $fillable = [
        'id',
        'message_schedule_id',
        'workspace_id',
        'project_id',
        'topic_id',
        'task_name',
        'status',
        'executed_at',
        'error_message',
    ];

    /**
     * Get the message schedule that owns this log.
     */
    public function messageSchedule()
    {
        return $this->belongsTo(MessageScheduleModel::class, 'message_schedule_id', 'id');
    }

    /**
     * Get the workspace that owns the message schedule log.
     */
    public function workspace()
    {
        return $this->belongsTo(WorkspaceModel::class, 'workspace_id', 'id');
    }

    /**
     * Get the project that owns the message schedule log.
     */
    public function project()
    {
        return $this->belongsTo(ProjectModel::class, 'project_id', 'id');
    }

    /**
     * Get the topic that owns the message schedule log.
     */
    public function topic()
    {
        return $this->belongsTo(TopicModel::class, 'topic_id', 'id');
    }
}
