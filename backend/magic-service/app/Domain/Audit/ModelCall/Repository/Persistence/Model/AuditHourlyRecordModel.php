<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

class AuditHourlyRecordModel extends Model
{
    protected ?string $table = 'magic_model_audit_hourly_records';

    protected array $fillable = [
        'stat_date',
        'bucket_start_at',
        'organization_code',
        'access_scope',
        'service_provider_config_id',
        'product_code',
        'request_count',
        'error_count',
        'input_tokens',
        'output_tokens',
        'total_tokens',
    ];

    protected array $casts = [
        'id' => 'integer',
        'bucket_start_at' => 'datetime',
        'service_provider_config_id' => 'integer',
        'request_count' => 'integer',
        'error_count' => 'integer',
        'input_tokens' => 'integer',
        'output_tokens' => 'integer',
        'total_tokens' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
