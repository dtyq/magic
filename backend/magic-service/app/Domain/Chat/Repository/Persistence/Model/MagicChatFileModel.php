<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

/**
 * @property string $file_id
 * @property int $file_type
 * @property string $file_key
 * @property int $file_size
 * @property string $file_name
 * @property string $file_extension
 * @property string $user_id
 * @property string $magic_message_id
 * @property string $organization_code
 * @property string $created_at
 * @property string $updated_at
 * @property string $deleted_at
 */
class MagicChatFileModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_chat_files';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'file_id',
        'file_type',
        'file_key',
        'file_size',
        'file_name',
        'file_extension',
        'user_id',
        'magic_message_id',
        'organization_code',
        'created_at',
        'updated_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'string',
        'file_id' => 'string',
    ];
}
