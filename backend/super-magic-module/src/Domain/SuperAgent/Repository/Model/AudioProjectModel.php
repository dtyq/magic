<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * Audio Project Model.
 *
 * @property int $id
 * @property int $project_id
 * @property null|int $topic_id
 * @property null|string $model_id
 * @property null|string $task_key
 * @property bool $auto_summary
 * @property string $source
 * @property string $audio_source
 * @property null|int $audio_file_id
 * @property null|string $device_id
 * @property null|int $duration
 * @property null|int $file_size
 * @property null|array $tags
 * @property null|string $current_phase
 * @property null|string $phase_status
 * @property int $phase_percent
 * @property null|string $phase_error
 * @property null|Carbon $created_at
 * @property null|Carbon $updated_at
 * @property null|Carbon $deleted_at
 */
class AudioProjectModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_super_agent_audio_project';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'project_id',
        'topic_id',
        'model_id',
        'task_key',
        'auto_summary',
        'source',
        'audio_source',
        'audio_file_id',
        'device_id',
        'duration',
        'file_size',
        'tags',
        'current_phase',
        'phase_status',
        'phase_percent',
        'phase_error',
        'created_at',
        'updated_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'project_id' => 'integer',
        'topic_id' => 'integer',
        'audio_file_id' => 'integer',
        'auto_summary' => 'boolean',
        'duration' => 'integer',
        'file_size' => 'integer',
        'phase_percent' => 'integer',
        'tags' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
