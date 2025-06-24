<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id
 * @property string $user_id 用户id
 * @property string $user_organization_code 用户组织编码
 * @property string $chat_conversation_id 聊天会话id
 * @property string $name 工作区名称
 * @property int $is_archived 是否归档 0否 1是
 * @property string $created_at
 * @property string $updated_at
 * @property string $deleted_at
 * @property int $current_topic_id
 * @property int $current_project_id 当前项目ID
 * @property int $status 状态 0:正常 1:不显示 2：删除
 */
class WorkspaceModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_super_agent_workspaces';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id', 'user_id', 'user_organization_code', 'chat_conversation_id', 'name',
        'is_archived', 'created_uid', 'updated_uid', 'created_at', 'updated_at', 'deleted_at',
        'current_topic_id', 'current_project_id', 'status',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'is_archived' => 'integer',
        'status' => 'integer',
        'current_topic_id' => 'integer',
        'current_project_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
