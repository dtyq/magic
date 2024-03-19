<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms;

/**
 * 所有短信驱动的返回结果必须转换为此对象
 */
class SendResult
{
    private int $code;

    private string $errorMsg;

    public function setResult(int $code, string $msg): SendResult
    {
        $this->errorMsg = $msg;
        $this->code = $code;
        return $this;
    }

    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'errorMsg' => $this->errorMsg,
        ];
    }
}
