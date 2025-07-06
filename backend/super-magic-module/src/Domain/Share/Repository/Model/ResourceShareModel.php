<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

/**
 * 资源分享模型.
 *
 * @property int $id ID
 * @property string $resource_id 资源ID
 * @property int $resource_type 资源类型
 * @property string $resource_name 资源名称
 * @property string $share_code 分享代码
 * @property int $share_type 分享类型
 * @property null|string $password 访问密码
 * @property null|string $expire_at 过期时间
 * @property int $view_count 查看次数
 * @property string $created_uid 创建者用户ID
 * @property string $updated_uid 更新者用户ID
 * @property string $organization_code 组织代码
 * @property null|string $target_ids 目标IDs
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property null|string $deleted_at 删除时间
 */
class ResourceShareModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * 表名.
     */
    protected ?string $table = 'magic_resource_shares';

    /**
     * 主键.
     */
    protected string $primaryKey = 'id';

    /**
     * 可批量赋值的属性.
     */
    protected array $fillable = [
        'id',
        'resource_id',
        'resource_type',
        'resource_name',
        'share_code',
        'share_type',
        'password',
        'expire_at',
        'view_count',
        'created_uid',
        'updated_uid',
        'organization_code',
        'target_ids',
        'deleted_at',
    ];

    /**
     * 自动类型转换.
     */
    protected array $casts = [
        'id' => 'integer',
        'resource_type' => 'integer',
        'share_type' => 'integer',
        'view_count' => 'integer',
        'target_ids' => 'json',
        'created_at' => 'string',
        'updated_at' => 'string',
        'deleted_at' => 'string',
        'expire_at' => 'string',
    ];
}
