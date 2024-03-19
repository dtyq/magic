<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Archive;

use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;

class FlowExecutorArchiveCloud
{
    public static function put(string $organizationCode, string $key, array $data): string
    {
        $name = "{$key}.log";

        // 直接检查序列化后的数据大小
        $serializedData = serialize($data);
        $dataSize = strlen($serializedData);
        $maxSize = 100 * 1024 * 1024; // 100MB

        if ($dataSize > $maxSize) {
            // 数据过大，不上传，直接返回空字符串
            return '';
        }

        $tmpDir = sys_get_temp_dir();
        $tmpFile = "{$tmpDir}/{$name}." . uniqid();

        try {
            // 数据大小符合要求，保存到临时文件
            file_put_contents($tmpFile, $serializedData);

            $uploadFile = new UploadFile($tmpFile, dir: 'MagicFlowExecutorArchive', name: $name, rename: false);
            di(FileDomainService::class)->uploadByCredential($organizationCode, $uploadFile, storage: StorageBucketType::Private, autoDir: false);
            return $uploadFile->getKey();
        } finally {
            if (file_exists($tmpFile)) {
                @unlink($tmpFile);
            }
        }
    }

    public static function get(string $organizationCode, string $executionId): mixed
    {
        $appId = config('kk_brd_service.app_id', 'open');
        $name = "{$organizationCode}/{$appId}/MagicFlowExecutorArchive/{$executionId}.log";
        $file = di(FileDomainService::class)->getLink($organizationCode, $name, StorageBucketType::Private);
        return unserialize(file_get_contents($file->getUrl()));
    }
}
