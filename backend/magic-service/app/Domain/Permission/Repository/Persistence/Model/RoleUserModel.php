<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\Relations\BelongsTo;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * 角色用户关联模型.
 *
 * @property int $id 主键ID
 * @property int $role_id 角色ID
 * @property string $user_id 用户ID，对应magic_contact_users.user_id
 * @property string $organization_code 组织编码
 * @property null|string $assigned_by 分配者用户ID
 * @property null|Carbon $assigned_at 分配时间
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 删除时间
 */
class RoleUserModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    /**
     * 与模型关联的表名.
     */
    protected ?string $table = 'magic_role_users';

    /**
     * 可批量赋值的属性.
     */
    protected array $fillable = [
        'id',
        'role_id',
        'user_id',
        'organization_code',
        'assigned_by',
        'assigned_at',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * 属性类型转换.
     */
    protected array $casts = [
        'id' => 'int',
        'role_id' => 'int',
        'user_id' => 'string',
        'organization_code' => 'string',
        'assigned_by' => 'string',
        'assigned_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * 角色关联.
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(RoleModel::class, 'role_id', 'id');
    }
}
