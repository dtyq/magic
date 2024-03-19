<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\ApiResponse\Response;

/**
 * 低代码平台响应结构体.
 */
class LowCodeResponse extends AbstractResponse
{
    protected int $successCode = 1000;

    public function body(): array
    {
        $result = [];
        $result['code'] = $this->code;
        $result['message'] = $this->message;
        $result['data'] = $this->data ?? null;

        return $result;
    }
}
