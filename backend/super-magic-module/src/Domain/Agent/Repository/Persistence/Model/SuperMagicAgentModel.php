<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id 雪花ID
 * @property string $organization_code 组织编码
 * @property string $code 唯一编码
 * @property string $name Agent名称
 * @property string $description Agent描述
 * @property array $icon Agent图标
 * @property int $icon_type 图标类型
 * @property array $prompt 系统提示词
 * @property array $tools 工具列表
 * @property int $type 智能体类型
 * @property bool $enabled 是否启用
 * @property string $creator 创建者
 * @property DateTime $created_at 创建时间
 * @property string $modifier 修改者
 * @property DateTime $updated_at 更新时间
 * @property null|DateTime $deleted_at 删除时间
 * @property array $name_i18n Agent 名称（多语言）
 * @property null|array $role_i18n 角色定位（多语言）
 * @property null|array $description_i18n 核心职责与适用场景描述（多语言）
 * @property string $source_type 关联来源类型：LOCAL_CREATE=本地创建, MARKET/STORE=市场添加
 * @property null|int $source_id 来源关联 ID
 * @property null|int $version_id 版本ID
 * @property null|string $version_code 市场原始 Agent code
 * @property null|DateTime $pinned_at 置顶时间
 * @property null|int $project_id 项目ID
 * @property null|string $file_key Agent 文件key
 * @property null|DateTime $latest_published_at Latest published timestamp
 */
class SuperMagicAgentModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_super_magic_agents';

    protected array $fillable = [
        'id',
        'organization_code',
        'code',
        'name',
        'description',
        'icon',
        'icon_type',
        'prompt',
        'tools',
        'type',
        'enabled',
        'creator',
        'created_at',
        'modifier',
        'updated_at',
        'name_i18n',
        'role_i18n',
        'description_i18n',
        'source_type',
        'source_id',
        'version_id',
        'version_code',
        'pinned_at',
        'project_id',
        'file_key',
        'latest_published_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'code' => 'string',
        'name' => 'string',
        'description' => 'string',
        'icon' => 'array',
        'icon_type' => 'integer',
        'prompt' => 'array',
        'tools' => 'array',
        'type' => 'integer',
        'enabled' => 'boolean',
        'creator' => 'string',
        'modifier' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'name_i18n' => 'array',
        'role_i18n' => 'array',
        'description_i18n' => 'array',
        'source_type' => 'string',
        'source_id' => 'integer',
        'version_id' => 'integer',
        'version_code' => 'string',
        'pinned_at' => 'datetime',
        'project_id' => 'integer',
        'file_key' => 'string',
        'latest_published_at' => 'datetime',
    ];
}
