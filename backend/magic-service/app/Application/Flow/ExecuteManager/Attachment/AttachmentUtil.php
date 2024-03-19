<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Attachment;

use App\Domain\Chat\DTO\Message\ChatMessage\AbstractAttachmentMessage;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\File\Service\FileDomainService;

class AttachmentUtil
{
    /**
     * @return array<Attachment>
     */
    public static function getByMagicMessageEntity(MagicMessageEntity $messageEntity): array
    {
        $attachments = [];
        $messageContent = $messageEntity->getContent();
        if ($messageContent instanceof AbstractAttachmentMessage) {
            $magicChatFileDomainService = di(MagicChatFileDomainService::class);
            $fileDomainService = di(FileDomainService::class);

            $chatFiles = $magicChatFileDomainService->getFileEntitiesByFileIds($messageContent->getFileIds());
            $fileOrgPaths = [];
            $chatFilesMaps = [];
            foreach ($chatFiles as $chatFile) {
                $fileOrgPaths[$chatFile->getOrganizationCode()][] = $chatFile->getFileKey();
                $chatFilesMaps[$chatFile->getFileKey()] = $chatFile;
            }
            foreach ($fileOrgPaths as $organizationCode => $filePaths) {
                $fileLinks = $fileDomainService->getLinks($organizationCode, $filePaths);
                foreach ($fileLinks as $fileLink) {
                    if (! $chatFile = $chatFilesMaps[$fileLink->getPath()] ?? null) {
                        continue;
                    }
                    $attachments[] = new Attachment(
                        name: $chatFile->getFileName(),
                        url: $fileLink->getUrl(),
                        ext: $chatFile->getFileExtension(),
                        size: $chatFile->getFileSize(),
                        chatFileId: $chatFile->getFileId() ?? '',
                    );
                }
            }
        }
        return $attachments;
    }

    public static function getByApiArray(array $data, bool $needUpload = false, string $organizationCode = ''): array
    {
        $attachments = [];
        foreach ($data as $datum) {
            if (empty($datum['attachment_url']) && empty($datum['url'])) {
                continue;
            }
            $attachment = new Attachment(
                name: ($datum['attachment_name'] ?? $datum['name'] ?? ''),
                url: ($datum['attachment_url'] ?? $datum['url'] ?? ''),
                ext: ($datum['attachment_ext'] ?? $datum['extension'] ?? ''),
                size: (int) ($datum['attachment_size'] ?? $datum['size'] ?? ''),
            );
            $attachment->setNeedUpload($needUpload);
            $attachment->setOrganizationCode($organizationCode);
            $attachments[] = $attachment;
        }
        return $attachments;
    }
}
