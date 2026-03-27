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
 * @property string $agent_code Agent 唯一标识码
 * @property int $agent_version_id 关联的 Agent 版本 ID
 * @property null|array $name_i18n 多语言展示名称
 * @property null|array $description_i18n 多语言展示描述
 * @property null|array $role_i18n 角色定位（多语言）
 * @property null|string $search_text 统一小写搜索字段
 * @property null|string $logo Logo 图片 URL
 * @property string $publisher_id 发布者用户 ID
 * @property string $publisher_type 发布者类型
 * @property null|int $category_id 分类 ID
 * @property string $publish_status 发布状态
 * @property int $install_count 安装次数
 * @property null|int $sort_order 排序值，数值越大越靠前
 * @property bool $is_featured 是否精选
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 软删除时间
 */
class AgentMarketModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_magic_agent_market';

    protected array $fillable = [
        'id',
        'agent_code',
        'agent_version_id',
        'name_i18n',
        'description_i18n',
        'role_i18n',
        'search_text',
        'icon',
        'icon_type',
        'publisher_id',
        'publisher_type',
        'category_id',
        'publish_status',
        'install_count',
        'sort_order',
        'is_featured',
        'organization_code',
    ];

    protected array $casts = [
        'id' => 'integer',
        'agent_code' => 'string',
        'agent_version_id' => 'integer',
        'name_i18n' => 'array',
        'description_i18n' => 'array',
        'role_i18n' => 'array',
        'search_text' => 'string',
        'icon' => 'array',
        'icon_type' => 'integer',
        'publisher_id' => 'string',
        'publisher_type' => 'string',
        'category_id' => 'integer',
        'publish_status' => 'string',
        'organization_code' => 'string',
        'install_count' => 'integer',
        'sort_order' => 'integer',
        'is_featured' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
