<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\AppMenu\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id 雪花ID
 * @property array $name_i18n 应用名称国际化
 * @property string $icon 应用图标标识
 * @property string $icon_url 应用图标图片地址
 * @property int $icon_type 图标类型
 * @property string $path 应用路径（菜单链接）
 * @property int $open_method 打开方式
 * @property int $sort_order 排序（展示优先级）
 * @property int $display_scope 可见范围
 * @property int $status 状态
 * @property string $creator_id 创建人ID
 * @property DateTime $created_at 创建时间
 * @property DateTime $updated_at 更新时间
 * @property null|DateTime $deleted_at 删除时间
 */
class AppMenuModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_applications';

    protected array $fillable = [
        'id',
        'name_i18n',
        'icon',
        'icon_url',
        'icon_type',
        'path',
        'open_method',
        'sort_order',
        'display_scope',
        'status',
        'creator_id',
        'created_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'name_i18n' => 'array',
        'icon' => 'string',
        'icon_url' => 'string',
        'icon_type' => 'integer',
        'path' => 'string',
        'open_method' => 'integer',
        'sort_order' => 'integer',
        'display_scope' => 'integer',
        'status' => 'integer',
        'creator_id' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
