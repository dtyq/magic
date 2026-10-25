<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Persistence\Model;

use Carbon\Carbon;
use Hyperf\DbConnection\Model\Model;

/**
 * @property int $id
 * @property string $organization_code
 * @property string $third_platform_type
 * @property string $third_file_id
 * @property array $latest_payload
 * @property null|Carbon $last_execute_at
 * @property null|Carbon $next_execute_at
 * @property string $status
 * @property int $notification_count
 */
class ThirdFileRevectorizeStateModel extends Model
{
    protected ?string $table = 'knowledge_third_file_revectorize_states';

    protected array $fillable = [
        'organization_code',
        'third_platform_type',
        'third_file_id',
        'latest_payload',
        'last_execute_at',
        'next_execute_at',
        'status',
        'notification_count',
    ];

    protected array $casts = [
        'id' => 'integer',
        'latest_payload' => 'array',
        'last_execute_at' => 'datetime',
        'next_execute_at' => 'datetime',
        'notification_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
