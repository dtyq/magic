<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore;

use Dtyq\RuleEngineCore\PhpScript\PlaceholderProvider;
use Dtyq\RuleEngineCore\PhpScript\PlaceholderProviderInterface;
use Dtyq\RuleEngineCore\PhpScript\Repository\DefaultExecutableCodeRepository;
use Dtyq\RuleEngineCore\PhpScript\Repository\DefaultRuleExecutionSetRepository;
use Dtyq\RuleEngineCore\PhpScript\Repository\ExecutableCodeRepositoryInterface;
use Dtyq\RuleEngineCore\PhpScript\Repository\RuleExecutionSetRepositoryInterface;

class ConfigProvider
{
    public function __invoke(): array
    {
        return [
            'dependencies' => [
                RuleExecutionSetRepositoryInterface::class => DefaultRuleExecutionSetRepository::class,
                PlaceholderProviderInterface::class => PlaceholderProvider::class,
                ExecutableCodeRepositoryInterface::class => DefaultExecutableCodeRepository::class,
            ],
            'commands' => [
            ],
            'annotations' => [
                'scan' => [
                    'paths' => [
                        __DIR__,
                    ],
                ],
            ],
        ];
    }
}
