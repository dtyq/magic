<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;

final class NotificationModel extends AbstractModel
{
    public bool $timestamps = false;

    public bool $incrementing = false;

    protected ?string $table = 'magic_notifications';

    protected string $keyType = 'string';

    protected array $fillable = [
        'id', 'organization_code', 'recipient_user_id', 'category', 'type', 'template_version', 'payload',
        'source_event_key', 'source_domain', 'source_type', 'source_id', 'source_version', 'message_status',
        'read_at', 'action_status', 'actioned_at', 'actioned_by', 'created_at', 'updated_at',
    ];

    protected array $casts = [
        'id' => 'string',
        'template_version' => 'integer',
        'payload' => 'array',
        'read_at' => 'datetime',
        'actioned_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
