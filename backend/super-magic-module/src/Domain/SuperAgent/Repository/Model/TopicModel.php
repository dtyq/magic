<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

/**
 * 话题模型.
 */
class TopicModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * 表名.
     */
    protected ?string $table = 'magic_super_agent_topics';

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
        'user_organization_code',
        'workspace_id',
        'project_id',
        'chat_topic_id',
        'chat_conversation_id',
        'sandbox_id',
        'sandbox_config',
        'current_task_id',
        'current_task_status',
        'topic_mode',
        'topic_name',
        'work_dir',
        'task_mode',
        'cost',
        'created_at',
        'updated_at',
        'deleted_at',
        'created_uid',
        'updated_uid',
        'commit_hash',
    ];

    /**
     * 日期字段.
     */
    protected array $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];
}
