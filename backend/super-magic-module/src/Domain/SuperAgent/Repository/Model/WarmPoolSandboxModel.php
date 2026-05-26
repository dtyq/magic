<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;

/**
 * One warm-pool sandbox record.
 *
 * @property int $id
 * @property string $sandbox_id
 * @property string $sandbox_name
 * @property string $agent_image
 * @property string $env
 * @property string $status
 * @property null|string $bound_user_id
 * @property null|string $bound_project_id
 * @property null|Carbon $bound_at
 * @property null|Carbon $expires_at
 * @property null|string $dead_reason
 * @property null|Carbon $created_at
 * @property null|Carbon $updated_at
 */
class WarmPoolSandboxModel extends AbstractModel
{
    /**
     * IDs are snowflake ids assigned by the repository, not MySQL AUTO_INCREMENT.
     */
    public bool $incrementing = false;

    protected ?string $table = 'magic_super_agent_warm_pool_sandboxes';

    protected string $keyType = 'int';

    protected array $fillable = [
        'id',
        'sandbox_id',
        'sandbox_name',
        'agent_image',
        'env',
        'status',
        'bound_user_id',
        'bound_project_id',
        'bound_at',
        'expires_at',
        'dead_reason',
        'created_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'bound_at' => 'datetime',
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
