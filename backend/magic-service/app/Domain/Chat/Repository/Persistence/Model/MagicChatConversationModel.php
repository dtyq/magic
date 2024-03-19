<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;

/**
 * @property string $id
 * @property string $user_id
 * @property string $user_organization_code
 * @property int $receive_type
 * @property string $receive_id
 * @property string $receive_organization_code
 * @property int $is_not_disturb
 * @property int $is_top
 * @property int $is_mark
 * @property int $status
 * @property string $extra
 * @property array $translate_config
 * @property array $instructs
 * @property string $created_at
 * @property string $updated_at
 * @property string $deleted_at
 */
class MagicChatConversationModel extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_chat_conversations';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'user_id',
        'user_organization_code',
        'receive_type',
        'receive_id',
        'receive_organization_code',
        'is_not_disturb',
        'is_top',
        'is_mark',
        'extra',
        'created_at',
        'updated_at',
        'deleted_at',
        'status',
        'translate_config',
        'instructs',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'string',
        'user_id' => 'string',
        'translate_config' => 'json',
        'instructs' => 'json',
    ];
}
