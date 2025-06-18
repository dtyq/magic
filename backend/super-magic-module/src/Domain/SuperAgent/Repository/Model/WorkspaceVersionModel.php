<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class WorkspaceVersionModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_agent_workspace_versions';

    protected array $fillable = [
        'id', 'topic_id', 'sandbox_id', 'commit_hash', 'dir', 'folder', 'created_at', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'topic_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
