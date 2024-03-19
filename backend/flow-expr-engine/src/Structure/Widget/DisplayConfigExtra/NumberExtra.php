<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Widget\DisplayConfigExtra;

class NumberExtra extends AbstractExtra
{
    private int $max;

    private int $min;

    private int $step;

    public function __construct(int $max, int $min, int $step)
    {
        $this->max = $max;
        $this->min = $min;
        $this->step = $step;
    }

    public function toArray(): array
    {
        return [
            'max' => $this->max,
            'min' => $this->min,
            'step' => $this->step,
        ];
    }

    public static function create(array $config, array $options = []): AbstractExtra
    {
        return new self(
            (int) ($config['extra']['max'] ?? 100000),
            (int) ($config['extra']['min'] ?? -100000),
            (int) ($config['extra']['step'] ?? 1)
        );
    }
}
