<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Repository\Model;

use Hyperf\Database\Model\Model;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

class ServiceProviderModelsModel extends Model
{
    use Snowflake;
    use SoftDeletes;

    protected array $fillable = [
        'id',
        'service_provider_config_id',
        'name',
        'model_version',
        'model_id',
        'model_parent_id',
        'category',
        'model_type',
        'config',
        'description',
        'sort',
        'icon',
        'status',
        'disabled_by',
        'translate',
        'organization_code',
        'visible_organizations',
        'visible_applications',
        'load_balancing_weight',
        'is_office',
        'super_magic_display_state',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected ?string $table = 'service_provider_models';
}
