<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence\Model;

use Carbon\Carbon;
use Hyperf\DbConnection\Model\Model;

/**
 * @property string $id
 * @property string $organization_code
 * @property string $user_id
 * @property string $access_token_id
 * @property string $environment
 * @property string $model
 * @property array $request_payload
 * @property null|array $response_payload
 * @property string $status
 * @property null|string $error_code
 * @property null|string $error_message
 * @property Carbon $created_at
 * @property Carbon $started_at
 * @property null|Carbon $finished_at
 * @property Carbon $updated_at
 */
class ImageGenerationTaskModel extends Model
{
    public bool $incrementing = false;

    protected ?string $table = 'magic_api_image_generation_tasks';

    protected string $primaryKey = 'id';

    protected string $keyType = 'string';

    protected array $fillable = [
        'id',
        'organization_code',
        'user_id',
        'access_token_id',
        'environment',
        'model',
        'request_payload',
        'response_payload',
        'status',
        'error_code',
        'error_message',
        'created_at',
        'started_at',
        'finished_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'string',
        'organization_code' => 'string',
        'user_id' => 'string',
        'access_token_id' => 'string',
        'environment' => 'string',
        'model' => 'string',
        'request_payload' => 'json',
        'response_payload' => 'json',
        'status' => 'string',
        'error_code' => 'string',
        'error_message' => 'string',
        'created_at' => 'datetime',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
