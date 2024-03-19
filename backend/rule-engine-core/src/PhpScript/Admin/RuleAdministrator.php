<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

use Dtyq\RuleEngineCore\PhpScript\Repository\ExecutableCodeRepositoryInterface;
use Dtyq\RuleEngineCore\PhpScript\Repository\RuleExecutionSetRepositoryInterface;
use Dtyq\RuleEngineCore\Standards\Admin\AbstractRuleAdministrator;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\Standards\Admin\Properties;
use Dtyq\RuleEngineCore\Standards\Admin\RuleAdministratorInterface;
use Dtyq\RuleEngineCore\Standards\Admin\RuleExecutionSetInterface;

class RuleAdministrator extends AbstractRuleAdministrator implements RuleAdministratorInterface
{
    protected ParserConfig $parserConfig;

    public function __construct(
        private RuleExecutionSetRepositoryInterface $repository,
        private ExecutableCodeRepositoryInterface $executableCodeRepository,
    ) {
        $this->parserConfig = new ParserConfig();
        parent::__construct();
    }

    public function registerExecutableCode(ExecutableCodeInterface $executableCode, ?Properties $properties = null): void
    {
        $this->executableCodeRepository->registerExecutableCode($executableCode, $properties);
    }

    public function registerRuleExecutionSet(string $bindUri, RuleExecutionSetInterface $set, ?Properties $properties = null): void
    {
        $this->repository->registerRuleExecutionSet($bindUri, $set, $properties);
    }

    public function deregisterRuleExecutionSet(string $bindUri, ?Properties $properties = null): void
    {
        // 不再检查规则是否已被注册
        //        if ($this->repository->getRuleExecutionSet($bindUri, $properties) == null) {
        //            throw new RuleExecutionSetDeregistrationException('Error while retrieving rule execution set bound to: ' . $bindUri, 1009);
        //        }

        $this->repository->unregisterRuleExecutionSet($bindUri, $properties);
    }

    protected function getRuleExecutionSetProviderClassname(InputType $inputType): ?array
    {
        return match ($inputType->value) {
            InputType::String => [
                'class' => StringRuleExecutionSetProvider::class,
                'constructor' => ['parserConfig' => $this->parserConfig, 'executableCodeRepository' => $this->executableCodeRepository],
            ],
            default => null,
        };
    }
}
