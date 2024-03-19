<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

use Dtyq\RuleEngineCore\PhpScript\PlaceholderProviderInterface;
use Dtyq\RuleEngineCore\PhpScript\Repository\ExecutableCodeRepositoryInterface;
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\Admin\Properties;
use Dtyq\RuleEngineCore\Standards\Admin\RuleExecutionSetInterface;
use Dtyq\RuleEngineCore\Standards\Admin\RuleExecutionSetProviderInterface;

class StringRuleExecutionSetProvider implements RuleExecutionSetProviderInterface
{
    public function __construct(
        private ParserConfig $parserConfig,
        private ExecutableCodeRepositoryInterface $executableCodeRepository,
    ) {
    }

    /**
     * @param null|RuleExecutionSetProperties $properties
     */
    public function createRuleExecutionSet(mixed $input, Properties $properties): RuleExecutionSetInterface
    {
        $set = new RuleExecutionSet();
        $set->setPlaceholderProvider(RuleServiceProvider::createInstance(PlaceholderProviderInterface::class));
        $properties->setExecutableFunctions($this->executableCodeRepository->getExecutableCodesByType(ExecutableType::from(ExecutableType::FUNCTION_TYPE), $properties->getRuleGroup(), $properties));
        $properties->setExecutableClasses($this->executableCodeRepository->getExecutableCodesByType(ExecutableType::from(ExecutableType::CLASS_TYPE), $properties->getRuleGroup(), $properties));
        $properties->setExecutableConstants($this->executableCodeRepository->getExecutableCodesByType(ExecutableType::from(ExecutableType::CONSTANT_TYPE), $properties->getRuleGroup(), $properties));
        empty($properties->getParserConfig()) && $properties->setParserConfig($this->parserConfig);
        $set->create($input, $properties);

        return $set;
    }
}
