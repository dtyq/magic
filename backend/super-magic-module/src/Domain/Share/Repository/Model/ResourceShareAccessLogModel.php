<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * 分享访问日志模型.
 */
class ResourceShareAccessLogModel extends AbstractModel
{
    /**
     * 是否自动维护时间戳.
     */
    public bool $timestamps = false; // 访问日志表使用 access_time 和 created_at，不使用 updated_at

    /**
     * 表名.
     */
    protected ?string $table = 'magic_resource_share_access_logs';

    /**
     * 可填充字段.
     */
    protected array $fillable = [
        'id',
        'share_id',
        'access_time',
        'user_type',
        'user_id',
        'user_name',
        'organization_code',
        'ip_address',
        'created_at',
    ];

    /**
     * 字段类型转换.
     */
    protected array $casts = [
        'id' => 'integer',
        'share_id' => 'integer',
        'access_time' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * 主键字段.
     */
    protected string $primaryKey = 'id';
}
