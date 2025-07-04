<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;

final class ProjectFileMention extends AbstractMention
{
    public function getTextStruct(): string
    {
        /** @var ProjectFileData $data */
        $data = $this->getAttrs()->getData();
        return $data instanceof ProjectFileData ? (string) ($data->getFileKey() ?? '') : '';
    }
}
