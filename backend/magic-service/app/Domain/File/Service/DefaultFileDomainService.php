<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Service;

use App\Domain\File\Constant\DefaultFileBusinessType;
use App\Domain\File\Entity\DefaultFileEntity;
use App\Domain\File\Repository\Persistence\DefaultFileRepository;

class DefaultFileDomainService
{
    public function __construct(protected DefaultFileRepository $defaultFileRepository, protected FileDomainService $fileDomainService)
    {
    }

    /**
     * @return DefaultFileEntity[]
     */
    public function getDefaultFile(DefaultFileBusinessType $defaultFileBusinessType): array
    {
        return $this->defaultFileRepository->getDefault($defaultFileBusinessType);
    }

    public function insert(DefaultFileEntity $defaultFileEntity): DefaultFileEntity
    {
        return $this->defaultFileRepository->insert($defaultFileEntity);
    }

    /**
     * 获取文件.
     * @return DefaultFileEntity[]
     */
    public function getByOrganizationCodeAndBusinessType(DefaultFileBusinessType $defaultFileBusiness, string $organizationCode): array
    {
        return $this->defaultFileRepository->getByOrganizationCodeAndBusinessType($defaultFileBusiness, $organizationCode);
    }

    public function getOnePublicKey(DefaultFileBusinessType $businessType): string
    {
        return $this->defaultFileRepository->getOnePublicUrl($businessType);
    }

    public function getByKey(string $key): ?DefaultFileEntity
    {
        return $this->defaultFileRepository->getByKey($key);
    }

    public function getByKeyAndBusinessType(string $key, string $businessType, string $organizationCode): ?DefaultFileEntity
    {
        return $this->defaultFileRepository->getByKeyAndBusinessType($key, $businessType, $organizationCode);
    }

    public function deleteByKey(string $key, string $organizationCode): bool
    {
        return $this->defaultFileRepository->deleteByKey($key, $organizationCode);
    }
}
