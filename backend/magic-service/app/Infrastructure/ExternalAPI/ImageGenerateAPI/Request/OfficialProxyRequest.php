<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class OfficialProxyRequest extends ImageGenerateRequest
{
    protected array $data = [];

    public function __construct(array $data = [])
    {
        $this->data = $data;
        parent::__construct();
    }

    /**
     * 官方代理请求，数据原封不动传递.
     */
    public function toArray(): array
    {
        return $this->data;
    }

    public function setData(array $data): void
    {
        $this->data = $data;
    }

    public function getData(): array
    {
        return $this->data;
    }
}
