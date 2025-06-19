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
        try {
            // 保存执行数据到临时文件
            file_put_contents("./{$name}", serialize($data));
            $uploadFile = new UploadFile("./{$name}", dir: 'MagicFlowExecutorArchive', name: $name, rename: false);
            di(FileDomainService::class)->uploadByCredential($organizationCode, $uploadFile, storage: StorageBucketType::Private, autoDir: false);
            return $uploadFile->getKey();
        } finally {
            if (file_exists("./{$name}")) {
                @unlink("./{$name}");
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
