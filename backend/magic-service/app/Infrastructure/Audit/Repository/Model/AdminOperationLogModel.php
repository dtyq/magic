<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Audit\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;

/**
 * 管理员操作日志模型.
 *
 * @property int $id 日志ID
 * @property null|string $organization_code 组织编码
 * @property null|string $user_id 操作人用户ID
 * @property null|string $user_name 操作人姓名
 * @property null|string $resource_code 资源代码
 * @property null|string $resource_label 资源名称
 * @property null|string $operation_code 操作代码
 * @property null|string $operation_label 操作名称
 * @property null|string $operation_description 操作详细描述
 * @property null|string $ip 操作IP
 * @property null|string $request_url 请求URL（包含方法和完整路径）
 * @property null|string $request_body 请求体内容（JSON格式）
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 */
class AdminOperationLogModel extends AbstractModel
{
    /**
     * 是否自动维护时间戳.
     */
    public bool $timestamps = true;

    /**
     * 与模型关联的表名.
     */
    protected ?string $table = 'admin_operation_logs';

    /**
     * 主键.
     */
    protected string $primaryKey = 'id';

    /**
     * 可批量赋值的属性.
     */
    protected array $fillable = [
        'organization_code',
        'user_id',
        'user_name',
        'resource_code',
        'resource_label',
        'operation_code',
        'operation_label',
        'operation_description',
        'ip',
        'request_url',
        'request_body',
    ];

    /**
     * 属性类型转换.
     */
    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'user_id' => 'string',
        'user_name' => 'string',
        'resource_code' => 'string',
        'resource_label' => 'string',
        'operation_code' => 'string',
        'operation_label' => 'string',
        'operation_description' => 'string',
        'ip' => 'string',
        'request_url' => 'string',
        'request_body' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
