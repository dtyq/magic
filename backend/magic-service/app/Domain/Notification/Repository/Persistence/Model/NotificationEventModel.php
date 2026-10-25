<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;

final class NotificationEventModel extends AbstractModel
{
    public bool $timestamps = false;

    public bool $incrementing = false;

    protected ?string $table = 'magic_notification_events';

    protected string $keyType = 'string';

    protected array $fillable = [
        'id', 'event_id', 'event_type', 'organization_code', 'source_domain', 'source_type', 'source_id',
        'source_version', 'event_payload', 'status', 'attempts', 'manual_retry_count', 'recipient_count',
        'notification_count', 'next_retry_at', 'last_error_code', 'last_error_message', 'processing_token',
        'locked_until', 'last_started_at', 'last_finished_at', 'last_retry_operator_id', 'last_retry_reason',
        'last_retry_at', 'created_at', 'updated_at',
    ];

    protected array $casts = [
        'id' => 'string',
        'event_payload' => 'array',
        'attempts' => 'integer',
        'manual_retry_count' => 'integer',
        'recipient_count' => 'integer',
        'notification_count' => 'integer',
        'next_retry_at' => 'datetime',
        'locked_until' => 'datetime',
        'last_started_at' => 'datetime',
        'last_finished_at' => 'datetime',
        'last_retry_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
