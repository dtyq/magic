<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id 主键 ID
 * @property int $agent_id 关联的 Agent ID
 * @property null|int $agent_version_id 关联的 Agent 版本 ID
 * @property string $agent_code Agent 代码标识
 * @property int $skill_id 关联的 Skill ID
 * @property int $skill_version_id 关联的 Skill 版本 ID
 * @property string $skill_code Skill 代码标识
 * @property int $sort_order Skill 在 Agent 中的展示排序
 * @property string $creator_id 绑定操作人用户 ID
 * @property Carbon $created_at 绑定时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 软删除时间
 */
class AgentSkillModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_magic_agent_skills';

    protected array $fillable = [
        'id',
        'agent_id',
        'agent_version_id',
        'agent_code',
        'skill_id',
        'skill_version_id',
        'organization_code',
        'organization_code',
        'skill_code',
        'sort_order',
        'creator_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'agent_id' => 'integer',
        'agent_version_id' => 'integer',
        'agent_code' => 'string',
        'skill_id' => 'integer',
        'skill_version_id' => 'integer',
        'skill_code' => 'string',
        'sort_order' => 'integer',
        'creator_id' => 'string',
        'organization_code' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
