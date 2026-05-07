<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Repository\Persistence\Model;

use DateTime;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $organization_code
 * @property string $user_id
 * @property int $project_id
 * @property string $generation_id
 * @property string $asset_type
 * @property string $generation_type
 * @property string $model_id
 * @property string $prompt
 * @property string $file_dir
 * @property string $file_name
 * @property array $input_payload
 * @property array $request_payload
 * @property array $provider_payload
 * @property array $output_payload
 * @property string $status
 * @property ?string $error_message
 * @property DateTime $created_at
 * @property DateTime $updated_at
 */
class DesignGenerationTaskModel extends Model
{
    use Snowflake;

    protected ?string $table = 'magic_design_generation_tasks';

    protected array $fillable = [
        'id',
        'organization_code',
        'user_id',
        'project_id',
        'generation_id',
        'asset_type',
        'generation_type',
        'model_id',
        'prompt',
        'file_dir',
        'file_name',
        'input_payload',
        'request_payload',
        'provider_payload',
        'output_payload',
        'status',
        'error_message',
        'created_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'int',
        'organization_code' => 'string',
        'user_id' => 'string',
        'project_id' => 'int',
        'generation_id' => 'string',
        'asset_type' => 'string',
        'generation_type' => 'string',
        'model_id' => 'string',
        'prompt' => 'string',
        'file_dir' => 'string',
        'file_name' => 'string',
        'input_payload' => 'array',
        'request_payload' => 'array',
        'provider_payload' => 'array',
        'output_payload' => 'array',
        'status' => 'string',
        'error_message' => 'string',
    ];
}
