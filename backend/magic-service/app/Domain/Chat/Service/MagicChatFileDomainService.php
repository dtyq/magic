<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\DTO\Message\ChatFileInterface;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\ChatAttachment;
use App\Domain\Chat\Entity\MagicChatFileEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class MagicChatFileDomainService extends AbstractDomainService
{
    /**
     * @param MagicChatFileEntity[] $fileUploadDTOs
     * @return MagicChatFileEntity[]
     */
    public function fileUpload(array $fileUploadDTOs, DataIsolation $dataIsolation): array
    {
        $time = date('Y-m-d H:i:s');
        foreach ($fileUploadDTOs as $fileUploadDTO) {
            $fileUploadDTO->setUserId($dataIsolation->getCurrentUserId());
            $fileUploadDTO->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $fileUploadDTO->setCreatedAt($time);
            $fileUploadDTO->setUpdatedAt($time);
            $fileUploadDTO->setMagicMessageId('');
        }
        return $this->magicFileRepository->uploadFiles($fileUploadDTOs);
    }

    /**
     * 判断用户的消息中，是否包含本次他想下载的文件.
     * @param MagicChatFileEntity[] $fileDTOs
     * @return MagicChatFileEntity[]
     */
    public function checkAndGetFilePaths(array $fileDTOs, DataIsolation $dataIsolation): array
    {
        // 检查 message_id 是否有此文件
        $seqIds = array_column($fileDTOs, 'message_id');
        $seqList = $this->magicSeqRepository->batchGetSeqByMessageIds($seqIds);
        $magicMessageIdsMap = [];
        // 检查用户是否收到了这些消息
        foreach ($seqList as $seq) {
            if ($seq->getObjectId() !== $dataIsolation->getCurrentMagicId()) {
                continue;
            }
            // message_id => magic_message_id
            $magicMessageIdsMap[$seq->getMessageId()] = $seq->getMagicMessageId();
        }
        $magicMessageIds = array_values($magicMessageIdsMap);
        if (empty($magicMessageIds)) {
            return [];
        }

        $tempMessagesEntities = $this->getMessageEntitiesByMaicMessageIds($magicMessageIds);
        $messageEntities = [];
        foreach ($tempMessagesEntities as $entity) {
            $messageEntities[$entity->getMagicMessageId()] = $entity;
        }

        // 给 $fileDTOs 加上 magic_message_id
        foreach ($fileDTOs as $fileDTO) {
            $messageId = $fileDTO->getMessageId();
            /* @var MagicChatFileEntity $fileDTO */
            if (isset($magicMessageIdsMap[$messageId])) {
                $magicMessageId = $magicMessageIdsMap[$messageId];
                $fileDTO->setMagicMessageId($magicMessageId);
            }
        }

        // 判断用户的消息中，是否包含本次他想下载的文件
        $fileMaps = [];
        foreach ($fileDTOs as $fileDTO) {
            $magicMessageId = $fileDTO->getMagicMessageId();
            $content = $messageEntities[$magicMessageId]->getContent();
            if (! $content instanceof ChatFileInterface) {
                continue;
            }
            $fileIdsInMessage = $content->getFileIds();
            if (in_array($fileDTO->getFileId(), $fileIdsInMessage)) {
                $fileMaps[] = $fileDTO;
            }
        }
        if (empty($fileMaps)) {
            return [];
        }
        $fileMapIds = array_column($fileMaps, 'file_id');
        return $this->getFileEntitiesByFileIds($fileMapIds);
    }

    /**
     * @return MagicChatFileEntity[]
     */
    public function getFileEntitiesByFileIds(array $fileIds, ?string $order = null, ?int $limit = null, bool $withUrl = false): array
    {
        // 获取文件路径
        $entities = $this->magicFileRepository->getChatFileByIds($fileIds, $order, $limit);
        if (! $withUrl) {
            return $entities;
        }
        foreach ($entities as $entity) {
            $fileLinks = $this->cloudFileRepository->getLinks($entity->getOrganizationCode(), [$entity->getFileKey()]);
            $fileKey = array_key_first($fileLinks);
            $fileLink = $fileLinks[$fileKey] ?? null;
            $entity->setExternalUrl($fileLink?->getUrl());
        }
        return $entities;
    }

    /**
     * 保存或更新文件
     * 如果file_key已存在，则更新文件信息
     * 如果file_key不存在，则创建新文件.
     *
     * @param MagicChatFileEntity $fileEntity 文件实体
     * @param DataIsolation $dataIsolation 数据隔离
     * @return MagicChatFileEntity 保存或更新后的文件实体
     */
    public function saveOrUpdateByFileKey(MagicChatFileEntity $fileEntity, DataIsolation $dataIsolation): MagicChatFileEntity
    {
        // 通过file_key查找文件是否存在
        $existingFile = $this->magicFileRepository->getChatFileByFileKey($fileEntity->getFileKey());

        // 如果文件存在，更新文件信息
        if ($existingFile) {
            $fileEntity->setFileId($existingFile->getFileId());
            $this->updateFile($fileEntity);
            return $fileEntity;
        }

        // 如果文件不存在，创建新文件
        $time = date('Y-m-d H:i:s');
        $fileEntity->setUserId($dataIsolation->getCurrentUserId());
        $fileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $fileEntity->setCreatedAt($time);
        $fileEntity->setUpdatedAt($time);
        $fileEntity->setMagicMessageId('');

        return $this->magicFileRepository->uploadFile($fileEntity);
    }

    /**
     * 判断用户的消息中的附件是不是他自己上传的.
     * @param ChatAttachment[] $attachments
     * @return ChatAttachment[]
     */
    public function checkAndFillAttachments(array $attachments, DataIsolation $dataIsolation): array
    {
        $fileIds = array_column($attachments, 'file_id');
        $fileEntities = $this->getFileEntitiesByFileIds($fileIds);
        $fileEntities = array_column($fileEntities, null, 'file_id');
        // todo 如果消息中有文件:1.判断文件的所有者是否是当前用户;2.判断用户是否接收过这些文件。
        //        foreach ($fileEntities as $fileEntity) {
        //            if ($fileEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
        //                ExceptionBuilder::throw(ChatErrorCode::FILE_NOT_FOUND);
        //            }
        //        }

        foreach ($attachments as $attachment) {
            $fileId = $attachment->getFileId();
            $fileEntity = $fileEntities[$fileId] ?? null;
            if ($fileEntity === null) {
                ExceptionBuilder::throw(ChatErrorCode::FILE_NOT_FOUND);
            }
            $attachment->setFileExtension($fileEntity->getFileExtension());
            $attachment->setFileSize($fileEntity->getFileSize());
            $attachment->setFileName($fileEntity->getFileName());
            $attachment->setFileType($fileEntity->getFileType());
        }
        return $attachments;
    }

    public function updateFile(MagicChatFileEntity $fileEntity): void
    {
        $this->magicFileRepository->updateFile($fileEntity);
    }

    public function updateFileById(string $fileId, MagicChatFileEntity $data): void
    {
        $this->magicFileRepository->updateFileById($fileId, $data);
    }
}
