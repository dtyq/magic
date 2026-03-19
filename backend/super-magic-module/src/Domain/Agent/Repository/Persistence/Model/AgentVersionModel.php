<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id 主键 ID（版本ID，雪花ID）
 * @property string $code Agent 唯一标识码
 * @property string $organization_code 归属组织编码
 * @property string $version 当前生效版本号
 * @property string $name Agent 名称
 * @property string $description Agent 描述
 * @property null|string $icon Agent 图标
 * @property int $icon_type 图标类型
 * @property int $type 智能体类型
 * @property bool $enabled 是否启用
 * @property null|array $prompt 系统提示词
 * @property null|array $tools 工具列表
 * @property string $creator 创建者
 * @property string $modifier 修改者
 * @property array $name_i18n Agent 名称（多语言）
 * @property null|array $role_i18n 角色定位（多语言）
 * @property null|array $description_i18n 核心职责与适用场景描述（多语言）
 * @property string $publish_status 发布状态
 * @property string $review_status 审核状态
 * @property string $publish_target_type 发布对象类型
 * @property null|array $publish_target_value 发布对象实际值
 * @property null|array $version_description_i18n 版本描述（多语言）
 * @property null|string $publisher_user_id 发布者用户ID
 * @property null|Carbon $published_at 发布时间
 * @property bool $is_current_version 是否当前版本
 * @property null|int $project_id 项目ID
 * @property null|string $file_key Agent package file key snapshot
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 软删除时间
 */
class AgentVersionModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_super_magic_agent_versions';

    protected array $fillable = [
        'id',
        'code',
        'organization_code',
        'version',
        'name',
        'description',
        'icon',
        'icon_type',
        'type',
        'enabled',
        'prompt',
        'tools',
        'creator',
        'modifier',
        'name_i18n',
        'role_i18n',
        'description_i18n',
        'publish_status',
        'review_status',
        'publish_target_type',
        'publish_target_value',
        'version_description_i18n',
        'publisher_user_id',
        'published_at',
        'is_current_version',
        'project_id',
        'file_key',
    ];

    protected array $casts = [
        'id' => 'integer',
        'code' => 'string',
        'organization_code' => 'string',
        'version' => 'string',
        'name' => 'string',
        'description' => 'string',
        'icon' => 'array',
        'icon_type' => 'integer',
        'type' => 'integer',
        'enabled' => 'boolean',
        'prompt' => 'array',
        'tools' => 'array',
        'creator' => 'string',
        'modifier' => 'string',
        'name_i18n' => 'array',
        'role_i18n' => 'array',
        'description_i18n' => 'array',
        'publish_status' => 'string',
        'review_status' => 'string',
        'publish_target_type' => 'string',
        'publish_target_value' => 'array',
        'version_description_i18n' => 'array',
        'publisher_user_id' => 'string',
        'published_at' => 'datetime',
        'is_current_version' => 'boolean',
        'project_id' => 'integer',
        'file_key' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
