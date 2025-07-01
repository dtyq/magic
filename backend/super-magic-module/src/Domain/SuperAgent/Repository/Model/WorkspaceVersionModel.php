<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class WorkspaceVersionModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_agent_workspace_versions';

    protected array $fillable = [
        'id', 'topic_id', 'sandbox_id', 'commit_hash', 'dir', 'folder', 'tag', 'created_at', 'updated_at', 'deleted_at', 'project_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'topic_id' => 'integer',
        'tag' => 'integer',
        'project_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
    }

    /**
     * Boot the model and add the auto-increment tag logic.
     */
    // protected static function booted()
    // {
    //     // Call the parent Model's booted method directly
    //     \Hyperf\DbConnection\Model\Model::booted();

    //     static::creating(function ($model) {
    //         if (!isset($model->tag)) {
    //             $model->tag = $model->getNextTag();
    //         }
    //     });
    // }

    /**
     * Get the next tag number for the given commit_hash and topic_id.
     */
    protected function getNextTag(): int
    {
        $latestTag = static::where('commit_hash', $this->commit_hash)
            ->where('topic_id', $this->topic_id)
            ->max('tag');

        return $latestTag ? $latestTag + 1 : 1;
    }
}
