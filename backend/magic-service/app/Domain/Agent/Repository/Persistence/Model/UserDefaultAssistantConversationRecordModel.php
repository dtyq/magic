<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Persistence\Model;

use Carbon\Carbon;
use Hyperf\DbConnection\Model\Model;

/**
 * @property int $id
 * @property string $user_id
 * @property string $ai_code
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class UserDefaultAssistantConversationRecordModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'user_default_assistant_conversation_records';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = ['id', 'user_id', 'ai_code', 'created_at', 'updated_at'];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = ['id' => 'integer', 'created_at' => 'datetime', 'updated_at' => 'datetime'];
}
