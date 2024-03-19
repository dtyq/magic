<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence\Model;

use App\Infrastructure\Util\Aes\AesUtil;
use Carbon\Carbon;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

use function Hyperf\Config\config;

/**
 * @property int $id
 * @property string $model
 * @property string $type
 * @property string $name
 * @property bool $enabled
 * @property float $total_amount
 * @property float $use_amount
 * @property int $rpm
 * @property float $exchange_rate
 * @property float $input_cost_per_1000
 * @property float $output_cost_per_1000
 * @property string $implementation
 * @property array $implementation_config
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property Carbon $deleted_at
 */
class ModelConfigModel extends Model
{
    use Snowflake;

    protected ?string $table = 'magic_api_model_configs';

    protected array $fillable = [
        'id',
        'model',
        'type',
        'name',
        'enabled',
        'total_amount',
        'use_amount',
        'rpm',
        'exchange_rate',
        'input_cost_per_1000',
        'output_cost_per_1000',
        'implementation',
        'implementation_config',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'int',
        'model' => 'string',
        'type' => 'string',
        'name' => 'string',
        'enabled' => 'boolean',
        'total_amount' => 'float',
        'use_amount' => 'float',
        'rpm' => 'int',
        'exchange_rate' => 'float',
        'input_cost_per_1000' => 'float',
        'output_cost_per_1000' => 'float',
        'implementation' => 'string',
        'implementation_config' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * 框架自动调用此方法进行对称加密.
     */
    public function setImplementationConfigAttribute(?array $config): void
    {
        if (empty($config)) {
            $config = [];
        }
        $this->attributes['implementation_config'] = AesUtil::encode($this->_getAesKey((string) $this->attributes['model']), Json::encode($config));
    }

    /**
     * 框架自动调用此方法进行对称解密.
     */
    public function getImplementationConfigAttribute(?string $config): array
    {
        if (empty($config)) {
            return [];
        }
        $modelConfig = AesUtil::decode($this->_getAesKey((string) $this->attributes['model']), $config);
        if ($modelConfig && json_validate($modelConfig)) {
            return Json::decode($modelConfig);
        }
        return [];
    }

    /**
     * aes key加盐.
     */
    private function _getAesKey(string $salt): string
    {
        return config('magic_flows.model_aes_key', '') . $salt;
    }
}
