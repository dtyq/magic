<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\ApiResponse\Response;

/**
 * 标准响应结构体.
 */
class StandardResponse extends AbstractResponse
{
    public function body(): array
    {
        $result = [];
        $result['code'] = $this->code;
        $result['message'] = $this->message;
        $this->data && $result['data'] = $this->data;

        return $result;
    }
}
