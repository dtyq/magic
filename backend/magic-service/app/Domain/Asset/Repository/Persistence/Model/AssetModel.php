<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\Events\Saving;
use Hyperf\Database\Model\SoftDeletes;
use InvalidArgumentException;

/**
 * 资产主表模型。
 */
class AssetModel extends AbstractModel
{
    use SoftDeletes;

    public bool $incrementing = false;

    protected string $keyType = 'int';

    protected ?string $table = 'magic_assets';

    protected array $fillable = [
        'id', 'organization_code', 'user_id', 'owner_uid', 'search_text', 'asset_kind', 'asset_business_type', 'parent_id', 'asset_media_type',
        'name_i18n', 'description_i18n', 'file_key', 'content_hash', 'status',
        'metadata', 'visibility_type', 'visibility', 'created_at', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer', 'organization_code' => 'string', 'user_id' => 'string', 'owner_uid' => 'string', 'search_text' => 'string',
        'asset_kind' => 'string', 'asset_business_type' => 'string', 'parent_id' => 'integer', 'asset_media_type' => 'string',
        'name_i18n' => 'array', 'description_i18n' => 'array', 'file_key' => 'string',
        'content_hash' => 'string', 'status' => 'boolean',
        'metadata' => 'array', 'visibility_type' => 'string', 'visibility' => 'array', 'created_at' => 'datetime', 'updated_at' => 'datetime', 'deleted_at' => 'datetime',
    ];

    /**
     * 归一化资产容器类型，避免依赖数据库默认值触发校验失败。
     */
    public static function normalizeAssetKind(mixed $assetKind): string
    {
        $assetKind = $assetKind === null || $assetKind === '' ? 'ASSET' : (string) $assetKind;
        if (! in_array($assetKind, ['ASSET', 'GROUP'], true)) {
            throw new InvalidArgumentException('素材类型不正确，请选择素材或素材组');
        }
        return $assetKind;
    }

    public function saving(Saving $event): void
    {
        $this->asset_kind = self::normalizeAssetKind($this->asset_kind);
    }
}
