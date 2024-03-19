<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback;

use Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback\BizData\BizData;

class DingCallbackMessage
{
    private string $signature;

    private string $timestamp;

    private string $nonce;

    private string $encryptMessage;

    private string $message;

    public function __construct(string $timestamp = '', string $nonce = '')
    {
        $this->timestamp = ! empty($timestamp) ? $timestamp : (string) time();
        $this->nonce = ! empty($nonce) ? $nonce : random_str();
    }

    public function getSignature(): string
    {
        return $this->signature;
    }

    public function setSignature(string $signature): void
    {
        $this->signature = $signature;
    }

    public function getTimestamp(): string
    {
        return $this->timestamp;
    }

    public function setTimestamp(string $timestamp): void
    {
        $this->timestamp = $timestamp;
    }

    public function getNonce(): string
    {
        return $this->nonce;
    }

    public function setNonce(string $nonce): void
    {
        $this->nonce = $nonce;
    }

    public function getEncryptMessage(): string
    {
        return $this->encryptMessage;
    }

    public function setEncryptMessage(string $encryptMessage): void
    {
        $this->encryptMessage = $encryptMessage;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function setMessage(string $message): void
    {
        $this->message = $message;
    }

    public function getArrayMessage(): array
    {
        if (empty($this->message)) {
            return [];
        }
        return json_decode($this->message, true);
    }

    public function toResponse(): array
    {
        return [
            'msg_signature' => $this->signature,
            'encrypt' => $this->encryptMessage,
            'timeStamp' => $this->timestamp,
            'nonce' => $this->nonce,
        ];
    }

    /**
     * @return BizData[]
     */
    public function createBizDataByEventSubscription(): array
    {
        $list = [];
        foreach ($this->getArrayMessage()['bizData'] ?? [] as $rawData) {
            if ($bizData = BizData::createByRawData($rawData)) {
                $list[] = $bizData;
            }
        }
        return $list;
    }
}
