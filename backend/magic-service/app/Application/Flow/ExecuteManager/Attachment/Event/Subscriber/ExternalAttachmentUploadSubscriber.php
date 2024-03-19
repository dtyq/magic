<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Attachment\Event\Subscriber;

use App\Application\Flow\ExecuteManager\Attachment\Event\ExternalAttachmentUploadEvent;
use App\Domain\Chat\Entity\MagicChatFileEntity;
use App\Domain\Chat\Entity\ValueObject\FileType;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\File\Service\FileDomainService;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;

#[AsyncListener]
#[Listener]
class ExternalAttachmentUploadSubscriber implements ListenerInterface
{
    public function listen(): array
    {
        return [
            ExternalAttachmentUploadEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof ExternalAttachmentUploadEvent) {
            return;
        }
        $externalAttachment = $event->externalAttachment;
        $organizationCode = $event->organizationCode;
        if (empty($externalAttachment->getChatFileId())) {
            return;
        }

        $uploadFile = new UploadFile($externalAttachment->getUrl(), 'flow-execute/external/');

        $fileDomainService = di(FileDomainService::class);
        $fileDomainService->uploadByCredential(
            $organizationCode,
            $uploadFile
        );

        $magicChatFileEntity = new MagicChatFileEntity();
        $magicChatFileEntity->setFileId($externalAttachment->getChatFileId());
        $magicChatFileEntity->setFileType(FileType::getTypeFromFileExtension($uploadFile->getExt()));
        $magicChatFileEntity->setFileSize($uploadFile->getSize());
        $magicChatFileEntity->setFileKey($uploadFile->getKey());
        $magicChatFileEntity->setFileName($uploadFile->getName());
        $magicChatFileEntity->setFileExtension($uploadFile->getExt());
        $chatFileDomainService = di(MagicChatFileDomainService::class);
        $chatFileDomainService->updateFile($magicChatFileEntity);
    }
}
