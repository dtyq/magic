<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * 角色模型.
 *
 * @property int $id 主键ID
 * @property string $name 角色名称
 * @property array $permission_key 角色权限列表
 * @property string $organization_code 组织编码
 * @property null|array $permission_tag 权限标签，用于前端展示分类
 * @property int $is_display 是否显示
 * @property int $status 状态: 0=禁用, 1=启用
 * @property null|string $created_uid 创建者用户ID
 * @property null|string $updated_uid 更新者用户ID
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 删除时间
 */
class RoleModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    /**
     * 状态常量.
     */
    public const int STATUS_DISABLED = 0;

    public const int STATUS_ENABLED = 1;

    /**
     * 与模型关联的表名.
     */
    protected ?string $table = 'magic_roles';

    /**
     * 可批量赋值的属性.
     */
    protected array $fillable = [
        'id',
        'name',
        'permission_key',
        'organization_code',
        'permission_tag',
        'is_display',
        'status',
        'created_uid',
        'updated_uid',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * 属性类型转换.
     */
    protected array $casts = [
        'id' => 'int',
        'name' => 'string',
        'permission_key' => 'array',
        'organization_code' => 'string',
        'permission_tag' => 'array',
        'is_display' => 'int',
        'status' => 'int',
        'created_uid' => 'string',
        'updated_uid' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * 获取权限列表.
     */
    public function getPermissions(): array
    {
        return $this->permission_key ?? [];
    }

    /**
     * 设置权限列表.
     */
    public function setPermissions(array $permissions): void
    {
        $this->permission_key = $permissions;
    }

    /**
     * 获取权限标签.
     */
    public function getPermissionTag(): ?array
    {
        return $this->permission_tag;
    }

    /**
     * 设置权限标签.
     */
    public function setPermissionTag(?array $permissionTag): void
    {
        $this->permission_tag = $permissionTag;
    }

    /**
     * 检查角色是否启用.
     */
    public function isEnabled(): bool
    {
        return $this->status === self::STATUS_ENABLED;
    }

    /**
     * 启用角色.
     */
    public function enable(): void
    {
        $this->status = self::STATUS_ENABLED;
    }

    /**
     * 禁用角色.
     */
    public function disable(): void
    {
        $this->status = self::STATUS_DISABLED;
    }
}
