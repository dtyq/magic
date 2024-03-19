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
 * @property string $code
 * @property string $name
 * @property string $description
 * @property string $icon
 * @property string $organization_code
 * @property string $created_uid
 * @property Carbon $created_at
 * @property string $updated_uid
 * @property Carbon $updated_at
 * @property Carbon $deleted_at
 */
class ApplicationModel extends Model
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_api_applications';

    protected array $fillable = [
        'id', 'code', 'name', 'description', 'icon',
        'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'int',
        'code' => 'string',
        'name' => 'string',
        'description' => 'string',
        'organization_code' => 'string',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
