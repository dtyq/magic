<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter\ChatBot;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Parameter\AbstractParameter;

class SendGroupMessageParameter extends AbstractParameter
{
    private string $robotCode;

    private string $openConversationId;

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

    public function getOpenConversationId(): string
    {
        return $this->openConversationId;
    }

    public function setOpenConversationId(string $openConversationId): void
    {
        $this->openConversationId = $openConversationId;
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
            throw new InvalidParameterException('robotCode is required');
        }
        if (empty($this->openConversationId)) {
            throw new InvalidParameterException('openConversationId is required');
        }
        if (empty($this->msgKey)) {
            throw new InvalidParameterException('msgKey is required');
        }
        if (empty($this->msgParam)) {
            throw new InvalidParameterException('msgParam is required');
        }
    }
}
