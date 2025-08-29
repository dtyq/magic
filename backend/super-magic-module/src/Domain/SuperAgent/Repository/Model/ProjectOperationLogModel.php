<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * 项目操作日志模型.
 */
class ProjectOperationLogModel extends AbstractModel
{
    /**
     * 是否自动维护时间戳.
     */
    public bool $timestamps = true;

    /**
     * 表名.
     */
    protected ?string $table = 'magic_super_agent_project_operation_logs';

    /**
     * 可填充字段.
     */
    protected array $fillable = [
        'id',
        'project_id',
        'user_id',
        'organization_code',
        'operation_action',
        'resource_type',
        'resource_id',
        'resource_name',
        'operation_details',
        'operation_status',
        'ip_address',
        'created_at',
        'updated_at',
    ];

    /**
     * 字段类型转换.
     */
    protected array $casts = [
        'id' => 'integer',
        'project_id' => 'integer',
        'operation_details' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * 主键字段.
     */
    protected string $primaryKey = 'id';
}
