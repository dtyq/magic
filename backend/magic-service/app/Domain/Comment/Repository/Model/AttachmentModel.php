<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Comment\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class AttachmentModel extends AbstractModel
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_attachments';

    /** php bin/hyperf.php gen:migration create_attachments_table
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id', 'target_id', 'target_type', 'uid', 'key', 'name', 'origin_type', 'organization_code',
        'created_at', 'updated_at', 'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer', 'target_id' => 'integer',
        'origin_type' => 'integer', 'created_at' => 'string', 'updated_at' => 'string',
    ];
}
