<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;

final class NotificationTemplateModel extends AbstractModel
{
    public bool $timestamps = false;

    public bool $incrementing = false;

    protected ?string $table = 'magic_notification_templates';

    protected string $keyType = 'string';

    protected array $fillable = [
        'id', 'template_type', 'version', 'locale', 'title_template', 'body_template', 'status',
        'created_at', 'updated_at',
    ];

    protected array $casts = [
        'id' => 'string',
        'version' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
