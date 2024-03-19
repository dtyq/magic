<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id
 * @property int $project_id
 * @property int $position_seconds
 * @property string $content
 * @property string $user_id
 * @property string $user_organization_code
 * @property string $created_uid
 * @property string $updated_uid
 * @property string $created_at
 * @property string $updated_at
 * @property string $deleted_at
 */
class AudioMarkerModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_super_agent_project_audio_markers';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id', 'project_id', 'position_seconds', 'content',
        'user_id', 'user_organization_code',
        'created_uid', 'updated_uid',
        'created_at', 'updated_at', 'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'project_id' => 'integer',
        'position_seconds' => 'integer',
        'content' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
