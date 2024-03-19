<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Request;

use App\Domain\Chat\DTO\Request\Common\ChatRequestData;
use App\Domain\Chat\DTO\Request\Common\MagicContext;

class ChatRequest extends AbstractRequest
{
    protected MagicContext $context;

    protected ChatRequestData $data;

    public function __construct(array $data)
    {
        parent::__construct($data);
    }

    public function getContext(): MagicContext
    {
        return $this->context;
    }

    public function setContext(array|MagicContext $context): void
    {
        if ($context instanceof MagicContext) {
            $this->context = $context;
        } else {
            $this->context = new MagicContext($context);
        }
    }

    public function getData(): ChatRequestData
    {
        return $this->data;
    }

    public function setData(array|ChatRequestData $data): void
    {
        if ($data instanceof ChatRequestData) {
            $this->data = $data;
        } else {
            $this->data = new ChatRequestData($data);
        }
    }
}
