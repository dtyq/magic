<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message;

/**
 * 从消息中获取文件ids，用于判断用户是否有文件的上传/下载权限.
 */
interface ChatFileInterface extends MessageInterface
{
    /**
     * @return array<string>
     */
    public function getFileIds(): array;
}
