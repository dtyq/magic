<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $knowledge_code
 * @property string $document_code
 * @property string $content
 * @property array $metadata
 * @property string $business_id
 * @property int $sync_status
 * @property int $sync_times
 * @property string $sync_status_message
 * @property string $point_id
 * @property string $vector
 * @property string $created_uid
 * @property DateTime $created_at
 * @property string $updated_uid
 * @property DateTime $updated_at
 * @property int $word_count 字数统计
 * @property int $version 版本
 */
class KnowledgeBaseFragmentsModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_flow_knowledge_fragment';

    protected array $fillable = [
        'id', 'knowledge_code', 'content', 'metadata', 'business_id', 'sync_status', 'sync_times', 'sync_status_message', 'point_id', 'vector',
        'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at', 'word_count', 'document_code', 'version',
    ];

    protected array $casts = [
        'id' => 'integer',
        'knowledge_code' => 'string',
        'document_code' => 'string',
        'content' => 'string',
        'metadata' => 'json',
        'business_id' => 'string',
        'sync_status' => 'integer',
        'sync_times' => 'integer',
        'sync_status_message' => 'string',
        'point_id' => 'string',
        'vector' => 'string',
        'word_count' => 'integer',

        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'version' => 'integer',
    ];
}
