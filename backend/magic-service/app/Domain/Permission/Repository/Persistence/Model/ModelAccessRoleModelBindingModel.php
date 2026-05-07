<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence\Model;

use App\Domain\Permission\Entity\ValueObject\ModelAccessRuleEffect;
use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $organization_code
 * @property int $role_id
 * @property string $model_id
 * @property string $effect
 * @property null|string $created_uid
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property null|Carbon $deleted_at
 */
class ModelAccessRoleModelBindingModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_model_access_role_models';

    protected array $fillable = [
        'id',
        'organization_code',
        'role_id',
        'model_id',
        'effect',
        'created_uid',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'int',
        'organization_code' => 'string',
        'role_id' => 'int',
        'model_id' => 'string',
        'effect' => 'string',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    protected array $attributes = [
        'effect' => ModelAccessRuleEffect::DENY->value,
    ];
}
