<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Widget\DisplayConfigExtra;

use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;

class SelectExtra extends AbstractExtra
{
    private bool $dynamicFields;

    private ?array $dataSource;

    private ?Component $dataSourceApi;

    public function __construct(
        bool $dynamicFields,
        ?array $dataSource = null,
        ?Component $dataSourceApi = null
    ) {
        $this->dynamicFields = $dynamicFields;
        $this->dataSource = $dataSource;
        $this->dataSourceApi = $dataSourceApi;
    }

    public function toArray(): array
    {
        return [
            'dynamic_fields' => $this->dynamicFields,
            'data_source' => $this->dataSource,
            'data_source_api' => $this->dataSourceApi?->toArray(),
        ];
    }

    public static function create(array $config, array $options = []): AbstractExtra
    {
        $dynamicFields = (bool) ($config['extra']['dynamic_fields'] ?? false);
        $dataSourceApi = null;
        if (! $dynamicFields) {
            $dataSource = (array) ($config['extra']['data_source'] ?? []);
        } else {
            $dataSource = null;
            $dataSourceApi = ComponentFactory::fastCreate($config['extra']['data_source_api'] ?? null);
        }

        return new self(
            $dynamicFields,
            $dataSource,
            $dataSourceApi
        );
    }
}
