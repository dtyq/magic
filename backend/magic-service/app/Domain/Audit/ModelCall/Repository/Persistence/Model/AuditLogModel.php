<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Repository\Persistence\Model;

use Carbon\Carbon;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * 模型审计日志Model.
 *
 * @property string $id 主键ID(雪花ID转字符串)
 * @property string $user_id Magic 用户 ID
 * @property string $organization_code 调用时组织编码
 * @property string $type 类型
 * @property string $product_code 引擎/模型标识
 * @property string $status 调用状态
 * @property string $ak 脱敏访问凭证
 * @property string $access_token_name API Key 名称快照
 * @property string $model_version 模型部署名快照（发给上游的真实 model id）
 * @property string $provider_name 服务商名称快照
 * @property int $operation_time 操作时间戳(毫秒)
 * @property int $all_latency 总延时(毫秒)
 * @property int $first_response_latency 首次响应延时TTFT(毫秒)，仅流式有值
 * @property array $usage 花费信息
 * @property null|array $detail_info 详情信息
 * @property null|string $access_scope 访问范围 api_platform / magic
 * @property null|string $magic_topic_id Magic 话题 ID
 * @property null|string $request_id 请求/链路 ID
 * @property null|string $event_id 事件唯一 ID（审计与计费关联）
 * @property null|int $points 计费回写积分
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 修改时间
 */
class AuditLogModel extends Model
{
    use Snowflake;

    protected ?string $table = 'magic_model_audit_logs';

    protected array $fillable = [
        'id',
        'user_id',
        'organization_code',
        'type',
        'product_code',
        'status',
        'ak',
        'access_token_name',
        'model_version',
        'provider_name',
        'operation_time',
        'all_latency',
        'first_response_latency',
        'usage',
        'detail_info',
        'access_scope',
        'magic_topic_id',
        'request_id',
        'event_id',
        'points',
    ];

    protected array $casts = [
        'id' => 'string',              // 必须转字符串,避免前端精度丢失
        'user_id' => 'string',
        'organization_code' => 'string',
        'type' => 'string',
        'product_code' => 'string',
        'status' => 'string',
        'ak' => 'string',
        'access_token_name' => 'string',
        'model_version' => 'string',
        'provider_name' => 'string',
        'operation_time' => 'integer',
        'all_latency' => 'integer',
        'first_response_latency' => 'integer',
        'usage' => 'array',            // JSON自动转数组
        'detail_info' => 'array',      // JSON自动转数组
        'access_scope' => 'string',
        'magic_topic_id' => 'string',
        'request_id' => 'string',
        'event_id' => 'string',
        'points' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
