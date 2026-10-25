<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Archive\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

/**
 * @property string $archive_mode
 * @property string $status
 * @property string $source_start_id
 * @property string $source_end_id
 * @property int $archived_count
 */
class ArchiveTaskRecordModel extends Model
{
    protected ?string $table = 'magic_data_archive_task_records';

    protected array $fillable = [
        'archive_type',
        'archive_mode',
        'stat_date',
        'source_start_id',
        'source_end_id',
        'status',
        'archived_count',
        'extra',
        'started_at',
        'finished_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'archived_count' => 'integer',
        'extra' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
