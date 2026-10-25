<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;

class MicroAppVisitModel extends AbstractModel
{
    protected ?string $table = 'magic_super_agent_micro_app_visits';

    protected array $fillable = [
        'micro_app_id', 'user_id', 'organization_code', 'last_visited_at', 'created_at', 'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'micro_app_id' => 'integer',
        'user_id' => 'string',
        'organization_code' => 'string',
        'last_visited_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
