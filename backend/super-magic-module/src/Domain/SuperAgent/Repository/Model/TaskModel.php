<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

/**
 * 任务模型.
 */
class TaskModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * 表名.
     */
    protected ?string $table = 'magic_super_agent_task';

    /**
     * 主键.
     */
    protected string $primaryKey = 'id';

    /**
     * 可填充字段.
     */
    protected array $fillable = [
        'id',
        'user_id',
        'workspace_id',
        'project_id',
        'topic_id',
        'task_id',
        'sandbox_id',
        'prompt',
        'attachments',
        'mentions',
        'task_status',
        'work_dir',
        'task_mode',
        'err_msg',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * 日期字段.
     */
    protected array $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * 获取任务所属的工作区.
     */
    public function workspace()
    {
        return $this->belongsTo(WorkspaceModel::class, 'workspace_id', 'id');
    }

    /**
     * 获取任务所属的项目.
     */
    public function project()
    {
        return $this->belongsTo(ProjectModel::class, 'project_id', 'id');
    }

    /**
     * 获取任务所属的话题.
     */
    public function topic()
    {
        return $this->belongsTo(TopicModel::class, 'topic_id', 'id');
    }
}
