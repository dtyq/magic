<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

class TaskFileCleanupRecordModel extends AbstractModel
{
    public bool $timestamps = false;

    protected ?string $table = 'magic_super_agent_task_file_cleanup_records';

    protected array $guarded = [];

    protected array $casts = [
        'id' => 'integer',
        'original_file_id' => 'integer',
        'project_id' => 'integer',
        'topic_id' => 'integer',
        'task_id' => 'integer',
        'parent_id' => 'integer',
        'root_file_id' => 'integer',
        'is_directory' => 'boolean',
        'attempt_count' => 'integer',
    ];
}
