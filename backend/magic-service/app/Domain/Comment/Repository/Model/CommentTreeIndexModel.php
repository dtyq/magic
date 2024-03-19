<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Comment\Repository\Model;

use Hyperf\Snowflake\Concern\Snowflake;

class CommentTreeIndexModel extends AbstractTreeIndexModel
{
    use Snowflake;

    protected ?string $table = 'magic_comment_tree_indexes';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'ancestor_id', 'descendant_id', 'distance', 'organization_code',
        'created_at', 'updated_at',
    ];

    protected array $casts = [
        'created_at' => 'string', 'updated_at' => 'string',
    ];
}
