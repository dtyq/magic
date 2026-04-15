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
 * 图片生成任务模型.
 * @property int $id
 * @property string $organization_code
 * @property string $user_id
 * @property int $project_id
 * @property string $image_id
 * @property string $model_id
 * @property ?string $prompt
 * @property ?string $size
 * @property ?string $resolution
 * @property string $file_dir
 * @property ?string $file_name
 * @property ?array $reference_images
 * @property ?array $reference_image_options
 * @property int $type
 * @property string $status
 * @property ?string $error_message
 * @property DateTime $created_at
 * @property DateTime $updated_at
 */
class ImageGenerationModel extends Model
{
    use Snowflake;

    protected ?string $table = 'magic_design_image_generation_tasks';

    protected array $fillable = [
        'id',
        'organization_code',
        'user_id',
        'project_id',
        'image_id',
        'model_id',
        'prompt',
        'size',
        'resolution',
        'file_dir',
        'file_name',
        'reference_images',
        'reference_image_options',
        'type',
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
        'image_id' => 'string',
        'model_id' => 'string',
        'prompt' => 'string',
        'size' => 'string',
        'resolution' => 'string',
        'file_dir' => 'string',
        'file_name' => 'string',
        'reference_images' => 'array',
        'reference_image_options' => 'array',
        'type' => 'int',
        'status' => 'string',
        'error_message' => 'string',
    ];
}
