<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter\ChatBot;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Parameter\AbstractParameter;

class SendOneOnOneChatMessagesParameter extends AbstractParameter
{
    private string $robotCode;

    private array $userIds;

    private string $msgKey = 'sampleText';

    private string $msgParam;

    public function getRobotCode(): string
    {
        return $this->robotCode;
    }

    public function setRobotCode(string $robotCode): void
    {
        $this->robotCode = $robotCode;
    }

    public function getUserIds(): array
    {
        return $this->userIds;
    }

    public function setUserIds(array $userIds): void
    {
        $this->userIds = $userIds;
    }

    public function getMsgKey(): string
    {
        return $this->msgKey;
    }

    public function setMsgKey(string $msgKey): void
    {
        $this->msgKey = $msgKey;
    }

    public function getMsgParam(): string
    {
        return $this->msgParam;
    }

    public function setMsgParam(string $msgParam): void
    {
        $this->msgParam = $msgParam;
    }

    protected function validateParams(): void
    {
        if (empty($this->robotCode)) {
            throw new InvalidParameterException('robot_code not empty');
        }
        if (empty($this->userIds)) {
            throw new InvalidParameterException('user_ids not empty');
        }
        if (empty($this->msgParam)) {
            throw new InvalidParameterException('msg_param not empty');
        }
    }
}
