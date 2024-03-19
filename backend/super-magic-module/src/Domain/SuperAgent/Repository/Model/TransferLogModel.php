<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * Transfer log model.
 */
class TransferLogModel extends AbstractModel
{
    /**
     * Whether to auto-maintain timestamps.
     */
    public bool $timestamps = true;

    /**
     * Table name.
     */
    protected ?string $table = 'magic_super_agent_transfer_logs';

    /**
     * Fillable fields.
     */
    protected array $fillable = [
        'id',
        'batch_id',
        'organization_code',
        'transfer_type',
        'resource_id',
        'resource_name',
        'from_user_id',
        'to_user_id',
        'share_to_original',
        'share_role',
        'projects_count',
        'files_count',
        'status',
        'error_message',
        'extra',
        'created_at',
        'updated_at',
    ];

    /**
     * Field type casting.
     */
    protected array $casts = [
        'id' => 'integer',
        'transfer_type' => 'integer',
        'resource_id' => 'integer',
        'share_to_original' => 'boolean',
        'projects_count' => 'integer',
        'files_count' => 'integer',
        'status' => 'integer',
        'extra' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Primary key field.
     */
    protected string $primaryKey = 'id';
}
