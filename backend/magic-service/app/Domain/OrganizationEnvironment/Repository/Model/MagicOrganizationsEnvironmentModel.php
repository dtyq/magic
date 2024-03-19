<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Repository\Model;

use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

class MagicOrganizationsEnvironmentModel extends Model
{
    use Snowflake;

    protected ?string $table = 'magic_organizations_environment';

    protected array $fillable = [
        'id',
        'login_code',
        'magic_organization_code',
        'origin_organization_code',
        'environment_id',
        'created_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'string',
    ];
}
