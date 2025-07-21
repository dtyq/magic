<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * 项目文件模型（原任务文件模型）.
 */
class ProjectFileModel extends AbstractModel
{
    /**
     * 软删除字段.
     */
    public const DELETED_AT = 'deleted_at';

    /**
     * 表名.
     */
    protected ?string $table = 'magic_super_agent_project_files';

    /**
     * 主键.
     */
    protected string $primaryKey = 'file_id';

    /**
     * 可填充字段.
     */
    protected array $fillable = [
        'user_id',
        'organization_code',
        'project_id',
        'topic_id',
        'task_id',
        'file_type',
        'file_name',
        'file_extension',
        'file_key',
        'file_size',
        'external_url',
        'storage_type',
        'is_hidden',
    ];

    /**
     * 字段类型转换.
     */
    protected array $casts = [
        'file_id' => 'integer',
        'project_id' => 'integer',
        'topic_id' => 'integer',
        'task_id' => 'integer',
        'file_size' => 'integer',
        'is_hidden' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
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
     * 获取文件所属的项目.
     */
    public function project()
    {
        return $this->belongsTo(ProjectModel::class, 'project_id', 'id');
    }

    /**
     * 获取文件所属的话题.
     */
    public function topic()
    {
        return $this->belongsTo(TopicModel::class, 'topic_id', 'id');
    }

    /**
     * 获取文件所属的任务
     */
    public function task()
    {
        return $this->belongsTo(TaskModel::class, 'task_id', 'id');
    }
}
