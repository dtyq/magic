<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Repository\Model;

use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

class MagicEnvironmentModel extends Model
{
    use Snowflake;

    protected ?string $table = 'magic_environments';

    protected array $fillable = [
        'id',
        'deployment',
        'environment',
        'environment_code',
        'open_platform_config',
        'private_config',
        'extra',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'open_platform_config' => 'array',
        'private_config' => 'array',
        'extra' => 'array',
    ];
}
