<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id
 * @property array $name_i18n
 * @property array $placeholder_i18n
 * @property string $identifier
 * @property string $icon
 * @property string $color
 * @property string $description
 * @property int $is_default
 * @property int $sort
 * @property bool $status
 * @property int $distribution_type
 * @property int $follow_mode_id
 * @property array $restricted_mode_identifiers
 * @property string $organization_code
 * @property string $creator_id
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property Carbon $deleted_at
 */
class ModeModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_modes';

    protected array $fillable = [
        'id',
        'name_i18n',
        'placeholder_i18n',
        'identifier',
        'icon',
        'color',
        'sort',
        'description',
        'is_default',
        'status',
        'distribution_type',
        'follow_mode_id',
        'restricted_mode_identifiers',
        'organization_code',
        'creator_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'name_i18n' => 'array',
        'placeholder_i18n' => 'array',
        'is_default' => 'integer',
        'status' => 'boolean',
        'distribution_type' => 'integer',
        'follow_mode_id' => 'integer',
        'restricted_mode_identifiers' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
