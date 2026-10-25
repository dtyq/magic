<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\ValueObject;

use App\Domain\File\Entity\ValueObject\FileDataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;

/**
 * 文件存储路径对象，统一管理存储桶标记和用户作用域目录。
 */
final readonly class FileStoragePath
{
    private const string OPEN_APP_ID = 'open';

    private string $organizationCode;

    private string $magicId;

    /**
     * 根据文件领域数据隔离对象创建存储路径。
     */
    public function __construct(
        FileDataIsolation $dataIsolation,
        private StorageBucketType $storage,
        private string $appId = self::OPEN_APP_ID,
    ) {
        $this->organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $this->magicId = $dataIsolation->getMagicId();
        if ($this->organizationCode === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if ($this->appId === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.empty', ['label' => 'app_id']);
        }
        if ($this->magicId !== '' && (str_contains($this->magicId, '/') || str_contains($this->magicId, '\\') || str_contains($this->magicId, '..'))) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => 'magic_id']);
        }
    }

    /**
     * 返回当前存储桶的新短标记。
     */
    public function marker(): string
    {
        return self::markerFor($this->storage);
    }

    /**
     * 返回自动生成的目录，可选择追加用户作用域。
     */
    public function directory(bool $withUserScope = false): string
    {
        $directory = sprintf('%s/%s/%s/', $this->organizationCode, $this->appId, $this->marker());
        if ($withUserScope) {
            if ($this->magicId === '') {
                ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'invalid_user_scope');
            }
            $directory .= 'u/' . $this->magicId . '/';
        }
        return $directory;
    }

    /**
     * 判断组织路径后的固定 marker 段是否匹配。
     */
    public static function matches(string $path, string $organizationCode, StorageBucketType $storage): bool
    {
        return self::matchesMarkerSegment($path, $organizationCode, self::markerFor($storage));
    }

    /**
     * 判断组织路径后的固定历史 MD5 marker 段是否匹配。
     */
    public static function matchesLegacy(string $path, string $organizationCode, StorageBucketType $storage): bool
    {
        return self::matchesMarkerSegment($path, $organizationCode, md5($storage->value));
    }

    /**
     * 返回指定存储桶的新短标记。
     */
    private static function markerFor(StorageBucketType $storage): string
    {
        return substr(md5($storage->value), 0, 4);
    }

    /**
     * 仅按组织码后的固定路径段匹配 marker，兼容 file-service 的内部组织 ID 段。
     */
    private static function matchesMarkerSegment(string $path, string $organizationCode, string $marker): bool
    {
        $segments = explode('/', trim($path, '/'));
        return ($segments[0] ?? '') === $organizationCode && ($segments[2] ?? '') === $marker;
    }
}
