<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $code
 * @property int $version
 * @property string $name
 * @property string $description
 * @property int $type
 * @property bool $enabled
 * @property string $business_id
 * @property int $sync_status
 * @property string $sync_status_message
 * @property string $model
 * @property string $vector_db
 * @property string $organization_code
 * @property string $created_uid
 * @property DateTime $created_at
 * @property string $updated_uid
 * @property DateTime $updated_at
 * @property int $expected_num
 * @property int $completed_num
 * @property string $retrieve_config
 * @property array $fragment_config
 * @property array $embedding_config
 * @property int $word_count 字数统计
 * @property string $icon 图标
 * @property ?int $source_type
 */
class KnowledgeBaseModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_flow_knowledge';

    protected array $fillable = [
        'id', 'code', 'version', 'name', 'description', 'type', 'enabled', 'business_id', 'sync_status', 'sync_status_message', 'model', 'vector_db',
        'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at', 'expected_num', 'completed_num', 'retrieve_config',
        'word_count', 'icon', 'fragment_config', 'embedding_config', 'source_type',
    ];

    protected array $casts = [
        'id' => 'integer',
        'code' => 'string',
        'version' => 'integer',
        'name' => 'string',
        'description' => 'string',
        'type' => 'integer',
        'enabled' => 'boolean',
        'business_id' => 'string',
        'sync_status' => 'integer',
        'sync_status_message' => 'string',
        'model' => 'string',
        'vector_db' => 'string',
        'expected_num' => 'integer',
        'completed_num' => 'integer',
        'retrieve_config' => 'string',
        'embedding_config' => 'array',
        'fragment_config' => 'array',
        'word_count' => 'integer',
        'icon' => 'string',
        'source_type' => 'integer',
        'organization_code' => 'string',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
