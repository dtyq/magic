<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Repository\LongTermMemory\Model;

use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\Domain\LongTermMemory\Enum\MemoryType;
use Carbon\Carbon;
use Hyperf\Database\Model\Model;

/**
 * @property string $id
 * @property string $content
 * @property ?string $pending_content
 * @property ?string $explanation
 * @property ?string $origin_text
 * @property MemoryType $memory_type
 * @property string $status
 * @property float $confidence
 * @property float $importance
 * @property int $access_count
 * @property int $reinforcement_count
 * @property float $decay_factor
 * @property array $tags
 * @property array $metadata
 * @property string $org_id
 * @property string $app_id
 * @property ?string $project_id
 * @property string $user_id
 * @property bool $enabled
 * @property ?Carbon $last_accessed_at
 * @property ?Carbon $last_reinforced_at
 * @property ?Carbon $expires_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property ?Carbon $deleted_at
 */
class LongTermMemoryModel extends Model
{
    public bool $incrementing = false;

    protected ?string $table = 'magic_long_term_memories';

    protected string $keyType = 'string';

    protected array $fillable = [
        'id', 'content', 'pending_content', 'explanation', 'origin_text', 'memory_type', 'status', 'enabled', 'confidence', 'importance',
        'access_count', 'reinforcement_count', 'decay_factor', 'tags',
        'metadata', 'org_id', 'app_id', 'project_id', 'user_id',
        'last_accessed_at', 'last_reinforced_at', 'expires_at', 'created_at', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'confidence' => 'float',
        'importance' => 'float',
        'access_count' => 'integer',
        'reinforcement_count' => 'integer',
        'decay_factor' => 'float',
        'enabled' => 'boolean',
        'tags' => 'json',
        'metadata' => 'json',
        'last_accessed_at' => 'datetime',
        'last_reinforced_at' => 'datetime',
        'expires_at' => 'datetime',
        'memory_type' => MemoryType::class,
        'status' => MemoryStatus::class,
    ];
}
