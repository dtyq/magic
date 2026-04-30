<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $organization_code
 * @property string $function_code
 * @property int $enabled
 * @property array $binding_scope
 * @property null|string $remark
 * @property DateTime $created_at
 * @property DateTime $updated_at
 */
class FunctionPermissionPolicyModel extends AbstractModel
{
    use Snowflake;

    public bool $timestamps = true;

    protected ?string $table = 'magic_function_permission_policies';

    protected array $fillable = [
        'id',
        'organization_code',
        'function_code',
        'enabled',
        'binding_scope',
        'remark',
    ];

    protected array $casts = [
        'id' => 'integer',
        'enabled' => 'integer',
        'binding_scope' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
