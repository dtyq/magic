<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id Primary key ID
 * @property string $organization_code Organization code
 * @property string $user_id Owner user ID
 * @property string $agent_code Agent code
 * @property null|int $agent_version_id Installed agent version ID
 * @property string $source_type Ownership source type
 * @property null|int $source_id Source record ID
 * @property Carbon $created_at Created timestamp
 * @property Carbon $updated_at Updated timestamp
 */
class UserAgentModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_magic_user_agents';

    protected array $fillable = [
        'id',
        'organization_code',
        'user_id',
        'agent_code',
        'agent_version_id',
        'source_type',
        'source_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'user_id' => 'string',
        'agent_code' => 'string',
        'agent_version_id' => 'integer',
        'source_type' => 'string',
        'source_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
