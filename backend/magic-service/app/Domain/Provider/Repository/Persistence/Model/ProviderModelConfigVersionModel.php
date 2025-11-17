<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property int $service_provider_model_id
 * @property float $creativity
 * @property int $max_tokens
 * @property float $temperature
 * @property int $vector_size
 * @property string $billing_type
 * @property float $time_pricing
 * @property float $input_pricing
 * @property float $output_pricing
 * @property string $billing_currency
 * @property bool $support_function
 * @property float $cache_hit_pricing
 * @property int $max_output_tokens
 * @property bool $support_embedding
 * @property bool $support_deep_think
 * @property float $cache_write_pricing
 * @property bool $support_multi_modal
 * @property bool $official_recommended
 * @property float $input_cost
 * @property float $output_cost
 * @property float $cache_hit_cost
 * @property float $cache_write_cost
 * @property float $time_cost
 * @property int $version
 * @property bool $is_current_version
 * @property string $created_at
 * @property string $updated_at
 */
class ProviderModelConfigVersionModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'service_provider_models_config_versions';

    protected array $fillable = [
        'id',
        'service_provider_model_id',
        'creativity',
        'max_tokens',
        'temperature',
        'vector_size',
        'billing_type',
        'time_pricing',
        'input_pricing',
        'output_pricing',
        'billing_currency',
        'support_function',
        'cache_hit_pricing',
        'max_output_tokens',
        'support_embedding',
        'support_deep_think',
        'cache_write_pricing',
        'support_multi_modal',
        'official_recommended',
        'input_cost',
        'output_cost',
        'cache_hit_cost',
        'cache_write_cost',
        'time_cost',
        'version',
        'is_current_version',
        'created_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'service_provider_model_id' => 'integer',
        'creativity' => 'float',
        'max_tokens' => 'integer',
        'temperature' => 'float',
        'vector_size' => 'integer',
        'billing_type' => 'string',
        'time_pricing' => 'float',
        'input_pricing' => 'float',
        'output_pricing' => 'float',
        'billing_currency' => 'string',
        'support_function' => 'boolean',
        'cache_hit_pricing' => 'float',
        'max_output_tokens' => 'integer',
        'support_embedding' => 'boolean',
        'support_deep_think' => 'boolean',
        'cache_write_pricing' => 'float',
        'support_multi_modal' => 'boolean',
        'official_recommended' => 'boolean',
        'input_cost' => 'float',
        'output_cost' => 'float',
        'cache_hit_cost' => 'float',
        'cache_write_cost' => 'float',
        'time_cost' => 'float',
        'version' => 'integer',
        'is_current_version' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
