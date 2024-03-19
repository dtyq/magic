<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript;

use Dtyq\RuleEngineCore\PhpScript\Admin\RuleExecutionSet;
use Dtyq\RuleEngineCore\PhpScript\Repository\RuleExecutionSetRepositoryInterface;
use Dtyq\RuleEngineCore\Standards\Admin\Properties;
use Dtyq\RuleEngineCore\Standards\Exception\InvalidRuleSessionException;
use Dtyq\RuleEngineCore\Standards\Exception\RuleExecutionSetNotFoundException;
use Dtyq\RuleEngineCore\Standards\ObjectFilterInterface;
use Dtyq\RuleEngineCore\Standards\RuleExecutionSetMetadataInterface;
use Dtyq\RuleEngineCore\Standards\RuleSessionType;
use Dtyq\RuleEngineCore\Standards\StatelessRuleSessionInterface;

class StatelessRuleSession implements StatelessRuleSessionInterface
{
    private RuleExecutionSetRepositoryInterface $executionSetRepository;

    private ?RuleExecutionSet $ruleExecutionSet;

    private ?Properties $properties;

    public function __construct(
        string $bindUri,
        ?Properties $properties,
        RuleExecutionSetRepositoryInterface $executionSetRepository,
    ) {
        $this->executionSetRepository = $executionSetRepository;
        $this->properties = $properties;

        $ruleSet = $executionSetRepository->getRuleExecutionSet($bindUri, $properties);
        if ($ruleSet == null) {
            throw new RuleExecutionSetNotFoundException('Rule execution set unbound', 1005004);
        }
        $this->ruleExecutionSet = $ruleSet;
    }

    public function getAsts(): array
    {
        $this->ruleExecutionSet
            ->replacePlaceholder($this->properties->getPlaceholders())
            ->parse();

        return $this->ruleExecutionSet->getAsts();
    }

    public function executeRules(array $facts, ?ObjectFilterInterface $filter = null): array
    {
        //        if (empty($facts)
        //            || array_diff_assoc($this->ruleExecutionSet->getEntryFacts(), array_keys($facts))
        //        ) {
        //            throw new InvalidRuleSessionException('Rule execution failure:incorrect fact', 1005005);
        //        }
        return $this->ruleExecutionSet->execute($facts, $this->properties->getPlaceholders());
    }

    public function getRuleExecutionSetMetadata(): RuleExecutionSetMetadataInterface
    {
        // TODO: Implement getRuleExecutionSetMetadata() method.
    }

    public function release(): void
    {
        $this->properties = null;
        $this->ruleExecutionSet = null;
    }

    public function getType(): RuleSessionType
    {
        return RuleSessionType::from(RuleSessionType::Stateless);
    }
}
