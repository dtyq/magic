<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * 回收站表模型.
 * 插入时由 Snowflake trait 自动生成雪花 ID.
 *
 * @property int $id
 * @property int $resource_type 资源类型：1=workspace,2=project,3=topic,4=file
 * @property int $resource_id 资源ID
 * @property string $resource_name 资源名称
 * @property string $owner_id 资源创建者ID(与业务表 user_id 一致，VARCHAR 128)
 * @property string $deleted_by 删除人ID(与业务表 user_id 一致，VARCHAR 128)
 * @property null|Carbon $deleted_at 删除时间
 * @property int $retain_days 有效期(天)
 * @property null|int $parent_id 父级资源ID
 * @property null|array $extra_data 扩展信息
 * @property null|Carbon $created_at 创建时间
 * @property null|Carbon $updated_at 更新时间
 */
class RecycleBinModel extends AbstractModel
{
    use Snowflake;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_recycle_bin';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'resource_type',
        'resource_id',
        'resource_name',
        'owner_id',
        'deleted_by',
        'deleted_at',
        'retain_days',
        'parent_id',
        'extra_data',
        'created_at',
        'updated_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'resource_type' => 'integer',
        'resource_id' => 'integer',
        'owner_id' => 'string',
        'deleted_by' => 'string',
        'retain_days' => 'integer',
        'parent_id' => 'integer',
        'extra_data' => 'array',
        'deleted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
