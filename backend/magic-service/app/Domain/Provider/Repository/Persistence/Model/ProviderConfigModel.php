<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use App\Infrastructure\Util\Aes\AesUtil;
use DateTime;
use Hyperf\Codec\Json;

use function Hyperf\Config\config;

/**
 * @property int $id
 * @property int $service_provider_id
 * @property string $organization_code
 * @property null|array|string $config
 * @property int $status
 * @property string $category
 * @property null|DateTime $created_at
 * @property null|DateTime $updated_at
 * @property null|DateTime $deleted_at
 * @property string $alias
 * @property null|array $translate
 */
class ProviderConfigModel extends AbstractModel
{
    protected ?string $table = 'service_provider_configs';

    protected array $fillable = [
        'id', 'service_provider_id', 'organization_code', 'config', 'status', 'category',
        'created_at', 'updated_at', 'deleted_at', 'alias', 'translate', 'sort',
    ];

    protected array $casts = [
        'id' => 'integer',
        'service_provider_id' => 'integer',
        'organization_code' => 'string',
        'config' => 'string', // Treat as string in DB, handle encoding/decoding in accessors
        'status' => 'integer',
        'category' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'alias' => 'string',
        'translate' => 'json',
        'sort' => 'integer',
    ];

    /**
     * Set the config attribute (AES encode).
     */
    public function setConfigAttribute(array $config): void
    {
        $this->attributes['config'] = AesUtil::encode($this->_getAesKey(), Json::encode($config));
    }

    /**
     * Get the config attribute (AES decode).
     */
    public function getConfigAttribute(string $config): array
    {
        $decode = AesUtil::decode($this->_getAesKey(), $config);
        if (! $decode) {
            return [];
        }
        return Json::decode($decode);
    }

    /**
     * Get AES key with salt (model ID).
     */
    private function _getAesKey(): string
    {
        // Use model ID as salt, consistent with ProviderConfigFactory
        return config('service_provider.model_aes_key', '') . (string) $this->attributes['id'];
    }
}
