<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Facade;

use App\Domain\Chat\Entity\MagicChatFileEntity;

interface MagicChatFileRepositoryInterface
{
    // 用户上传了文件
    public function uploadFile(MagicChatFileEntity $magicFileDTO): MagicChatFileEntity;

    /**
     * 批量上传文件.
     * @param MagicChatFileEntity[] $magicFileDTOs
     * @return MagicChatFileEntity[]
     */
    public function uploadFiles(array $magicFileDTOs): array;

    /**
     * @return MagicChatFileEntity[]
     */
    public function getChatFileByIds(array $fileIds, ?string $order = null, ?int $limit = null): array;

    /**
     * 通过file_key查找文件.
     */
    public function getChatFileByFileKey(string $fileKey): ?MagicChatFileEntity;

    public function updateFile(MagicChatFileEntity $fileEntity): void;

    public function updateFileById(string $fileId, MagicChatFileEntity $entity);
}
