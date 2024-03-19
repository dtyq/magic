<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Contracts\Endpoint;

class EndpointConfig
{
    public function __construct(
        private readonly string $name,
        private readonly EndpointType $type,
        private readonly array $options = []
    ) {
        $this->loadOptions($options);
    }

    public function loadOptions(array $options = [])
    {
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getType(): EndpointType
    {
        return $this->type;
    }

    public function getOptions(): array
    {
        return $this->options;
    }
}
