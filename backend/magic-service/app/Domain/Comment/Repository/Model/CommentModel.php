<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Comment\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

class CommentModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_comments';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id', 'type', 'resource_id', 'resource_type', 'parent_id', 'message', 'creator',
        'description', 'attachments',
        'organization_code', 'created_at', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'created_at' => 'string', 'updated_at' => 'string', 'deleted_at' => 'string',
    ];
}
