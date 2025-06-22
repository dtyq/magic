<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Snowflake\Concern\Snowflake;

class FileCleanupRecordModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_file_cleanup_records';

    /**
     * 可批量赋值的属性.
     */
    protected array $fillable = [
        'id', 'organization_code', 'file_key', 'file_name', 'file_size', 'bucket_type',
        'source_type', 'source_id', 'expire_at', 'status', 'retry_count', 'error_message',
        'created_at', 'updated_at',
    ];

    protected array $casts = [
        'created_at' => 'string',
        'updated_at' => 'string',
        'expire_at' => 'string',
        'file_size' => 'integer',
        'status' => 'integer',
        'retry_count' => 'integer',
    ];
}
