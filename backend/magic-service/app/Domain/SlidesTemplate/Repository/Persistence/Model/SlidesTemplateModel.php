<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id
 * @property string $organization_code
 * @property string $owner_type
 * @property null|string $owner_id
 * @property null|int $project_id
 * @property null|int $project_directory_id
 * @property string $code
 * @property string $source_type
 * @property null|string $category_code
 * @property array $label
 * @property array $description
 * @property null|string $search_text
 * @property string $thumbnail_file_key
 * @property null|array $colors
 * @property null|string $collage_file_key
 * @property null|array $preview_image_file_keys
 * @property string $template_file_key
 * @property null|string $preview_url
 * @property int $status
 * @property int $sort
 * @property int $base_usage_count
 * @property int $actual_usage_count
 * @property int $total_usage_count
 * @property null|string $created_uid
 * @property null|string $updated_uid
 * @property null|Carbon $created_at
 * @property null|Carbon $updated_at
 * @property null|Carbon $deleted_at
 */
class SlidesTemplateModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_slides_templates';

    protected array $fillable = [
        'id',
        'organization_code',
        'owner_type',
        'owner_id',
        'project_id',
        'project_directory_id',
        'code',
        'source_type',
        'category_code',
        'label',
        'description',
        'search_text',
        'thumbnail_file_key',
        'colors',
        'collage_file_key',
        'preview_image_file_keys',
        'template_file_key',
        'preview_url',
        'status',
        'sort',
        'base_usage_count',
        'actual_usage_count',
        'total_usage_count',
        'created_uid',
        'updated_uid',
    ];

    protected array $casts = [
        'id' => 'integer',
        'owner_type' => 'string',
        'owner_id' => 'string',
        'project_id' => 'integer',
        'project_directory_id' => 'integer',
        'source_type' => 'string',
        'category_code' => 'string',
        'label' => 'array',
        'description' => 'array',
        'preview_image_file_keys' => 'array',
        'colors' => 'array',
        'search_text' => 'string',
        'status' => 'integer',
        'sort' => 'integer',
        'base_usage_count' => 'integer',
        'actual_usage_count' => 'integer',
        'total_usage_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
