<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Service;

use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\CloudFile\Kernel\AdapterName;
use Psr\SimpleCache\CacheInterface;

use function Hyperf\Config\config;
use function Hyperf\Support\env;

class FileTemporaryCredentialDomainService
{
    public function __construct(
        private readonly FileDomainService $fileDomainService,
        private readonly CacheInterface $cache,
    ) {
    }

    public function getStsTemporaryCredentialV2(
        string $organizationCode,
        StorageBucketType $storage,
        string $dir = '',
        int $expires = 3600,
        bool $autoBucket = true,
        array $options = []
    ): array {
        // 调用文件服务获取STS Token
        $data = $this->fileDomainService->getStsTemporaryCredential(
            $organizationCode,
            $storage,
            $dir,
            $expires,
            $autoBucket,
            $options,
        );

        // 如果是本地驱动，那么增加一个临时 key
        if ($data['platform'] === AdapterName::LOCAL) {
            $localCredential = 'local_credential:' . IdGenerator::getUniqueId32();
            $data['temporary_credential']['dir'] = $organizationCode . '/' . $data['temporary_credential']['dir'];
            $data['temporary_credential']['credential'] = $localCredential;
            $data['temporary_credential']['read_host'] = env('FILE_LOCAL_DOCKER_READ_HOST', 'http://magic-caddy/files');
            $data['temporary_credential']['host'] = env('FILE_LOCAL_DOCKER_WRITE_HOST', '');
            $this->cache->set($localCredential, ['organization_code' => $organizationCode], (int) ($data['expires'] - time()));
        }

        // magic service 服务地址
        $data['magic_service_host'] = config('super-magic.sandbox.callback_host', '');

        return $data;
    }
}
