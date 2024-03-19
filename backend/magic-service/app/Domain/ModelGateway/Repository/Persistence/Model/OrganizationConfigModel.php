<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence\Model;

use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $app_code
 * @property string $organization_code
 * @property float $total_amount
 * @property float $use_amount
 * @property int $rpm
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property Carbon $deleted_at
 */
class OrganizationConfigModel extends Model
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_api_organization_configs';

    protected array $fillable = [
        'id', 'app_code', 'organization_code', 'total_amount', 'use_amount', 'rpm',
        'created_at', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'int',
        'app_code' => 'string',
        'organization_code' => 'string',
        'total_amount' => 'float',
        'use_amount' => 'float',
        'rpm' => 'int',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
