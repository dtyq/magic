<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;

/**
 * @property int $id Primary key ID
 * @property string $organization_code Organization code
 * @property string $user_id Owner user ID
 * @property string $skill_code Skill code
 * @property null|int $skill_version_id Installed skill version ID
 * @property string $source_type Ownership source type
 * @property null|int $source_id Source record ID
 * @property Carbon $created_at Created timestamp
 * @property Carbon $updated_at Updated timestamp
 */
class UserSkillModel extends AbstractModel
{
    protected ?string $table = 'magic_user_skills';

    protected array $fillable = [
        'id',
        'organization_code',
        'user_id',
        'skill_code',
        'skill_version_id',
        'source_type',
        'source_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'user_id' => 'string',
        'skill_code' => 'string',
        'skill_version_id' => 'integer',
        'source_type' => 'string',
        'source_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
