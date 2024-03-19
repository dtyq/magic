<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Chat\Entity\MagicChatFileEntity;
use App\Domain\Chat\Entity\ValueObject\FileType;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;

/**
 * 聊天文件应用服务
 * 提供给其他领域使用的接口.
 */
class MagicChatFileAppService extends AbstractAppService
{
    public function __construct(
        private readonly MagicChatFileDomainService $magicChatFileDomainService,
        private readonly FileDomainService $fileDomainService
    ) {
    }

    /**
     * 通过file_key保存或更新文件
     * 如果文件已存在则更新，不存在则创建.
     *
     * @param string $fileKey 文件key
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param array $fileData 文件数据
     * @return array 返回包含文件信息的数组
     */
    public function saveOrUpdateByFileKey(string $fileKey, DataIsolation $dataIsolation, array $fileData): array
    {
        // 1. 准备文件实体
        $fileEntity = new MagicChatFileEntity();
        $fileEntity->setFileKey($fileKey);
        $fileEntity->setFileExtension($fileData['file_extension'] ?? '');
        $fileEntity->setFileName($fileData['filename'] ?? '');
        $fileEntity->setFileSize($fileData['file_size'] ?? 0);

        // 处理文件类型
        $fileTypeValue = $fileData['file_type'] ?? FileType::File->value;
        $fileType = FileType::tryFrom($fileTypeValue) ?? FileType::File;
        $fileEntity->setFileType($fileType);

        // 2. 保存或更新文件
        $savedFile = $this->magicChatFileDomainService->saveOrUpdateByFileKey($fileEntity, $dataIsolation);

        // 3. 获取文件URL
        $fileUrl = $this->fileDomainService->getLink(
            $dataIsolation->getCurrentOrganizationCode(),
            $fileKey
        )?->getUrl() ?? '';

        // 4. 返回文件信息
        return [
            'file_id' => $savedFile->getFileId(),
            'file_key' => $savedFile->getFileKey(),
            'file_extension' => $savedFile->getFileExtension(),
            'file_name' => $savedFile->getFileName(),
            'file_size' => $savedFile->getFileSize(),
            'file_type' => $savedFile->getFileType()->value,
            'external_url' => $fileUrl,
        ];
    }

    /**
     * 获取文件信息.
     *
     * @param string $fileId 文件ID
     * @return null|array 文件信息
     */
    public function getFileInfo(string $fileId): ?array
    {
        // 通过ID获取文件实体
        $fileEntities = $this->magicChatFileDomainService->getFileEntitiesByFileIds([$fileId], null, null, true);
        if (empty($fileEntities)) {
            return null;
        }

        $fileEntity = $fileEntities[0];

        // 返回文件信息数组
        return [
            'file_id' => $fileEntity->getFileId(),
            'file_key' => $fileEntity->getFileKey(),
            'file_extension' => $fileEntity->getFileExtension(),
            'file_name' => $fileEntity->getFileName(),
            'file_size' => $fileEntity->getFileSize(),
            'file_type' => $fileEntity->getFileType()->value,
            'external_url' => $fileEntity->getExternalUrl(),
        ];
    }
}
