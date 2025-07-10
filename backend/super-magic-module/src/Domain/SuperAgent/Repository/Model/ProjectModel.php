<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

/**
 * 项目模型.
 */
class ProjectModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * 软删除字段.
     */
    public const DELETED_AT = 'deleted_at';

    /**
     * 表名.
     */
    protected ?string $table = 'magic_super_agent_project';

    /**
     * 可填充字段.
     */
    protected array $fillable = [
        'id',
        'user_id',
        'user_organization_code',
        'workspace_id',
        'project_name',
        'project_description',
        'work_dir',
        'project_status',
        'current_topic_id',
        'current_topic_status',
        'project_mode',
        'created_uid',
        'updated_uid',
    ];

    /**
     * 字段类型转换.
     */
    protected array $casts = [
        'id' => 'integer',
        'workspace_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * 获取项目所属的工作区.
     */
    public function workspace()
    {
        return $this->belongsTo(WorkspaceModel::class, 'workspace_id', 'id');
    }

    /**
     * 获取项目下的话题列表.
     */
    public function topics()
    {
        return $this->hasMany(TopicModel::class, 'project_id', 'id');
    }

    /**
     * 获取项目下的文件列表.
     */
    public function files()
    {
        return $this->hasMany(ProjectFileModel::class, 'project_id', 'id');
    }
}
