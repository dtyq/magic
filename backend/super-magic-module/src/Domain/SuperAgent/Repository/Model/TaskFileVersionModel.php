<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class TaskFileVersionModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_agent_task_file_versions';

    protected string $primaryKey = 'id';

    /**
     * 可填充字段列表.
     */
    protected array $fillable = [
        'id',
        'file_id',
        'organization_code',
        'file_key',
        'version',
        'edit_type',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * 类型转换.
     */
    protected array $casts = [
        'id' => 'integer',
        'file_id' => 'integer',
        'version' => 'integer',
        'edit_type' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
