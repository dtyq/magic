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
 * @property string $organization_code 归属组织编码
 * @property int $agent_id 归属 Agent ID
 * @property null|int $agent_version_id 归属 Agent 版本 ID
 * @property string $agent_code Agent 代码标识
 * @property array $name_i18n Playbook 名称（多语言）
 * @property null|array $description_i18n Playbook 描述（多语言）
 * @property null|string $icon 图标标识（emoji 或图标 key）
 * @property null|string $theme_color 主题色
 * @property bool $is_enabled 启用状态
 * @property int $sort_order 展示排序权重
 * @property null|array $config Playbook 配置 JSON
 * @property string $creator_id 创建者用户 ID
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 软删除时间
 */
class AgentPlaybookModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_magic_agent_playbooks';

    protected array $fillable = [
        'id',
        'organization_code',
        'agent_id',
        'agent_version_id',
        'agent_code',
        'name_i18n',
        'description_i18n',
        'icon',
        'theme_color',
        'is_enabled',
        'sort_order',
        'config',
        'creator_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'agent_id' => 'integer',
        'agent_version_id' => 'integer',
        'agent_code' => 'string',
        'name_i18n' => 'array',
        'description_i18n' => 'array',
        'icon' => 'string',
        'theme_color' => 'string',
        'is_enabled' => 'boolean',
        'sort_order' => 'integer',
        'config' => 'array',
        'creator_id' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
