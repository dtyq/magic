<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

use Dtyq\RuleEngineCore\PhpScript\RuleType;
use Dtyq\RuleEngineCore\Standards\Admin\Properties;

class RuleExecutionSetProperties extends Properties
{
    private string $name;

    private string $description;

    private array $entryFacts = [];

    private int $ruleType = RuleType::Script;

    private ?ParserConfig $parserConfig = null;

    private string $ruleGroup;

    /**
     * @var ExecutableClass[]
     */
    private array $executableClasses = [];

    /**
     * @var ExecutableFunction[]
     */
    private array $executableFunctions = [];

    /**
     * @var ExecutableConstant[]
     */
    private array $executableConstants = [];

    private array $placeholders = [];

    private bool $resolvePlaceholders = false;

    public function getName(): string
    {
        return $this->name ?? '';
    }

    public function setName(string $name): RuleExecutionSetProperties
    {
        $this->name = $name;
        return $this;
    }

    public function getDescription(): string
    {
        return $this->description ?? '';
    }

    public function setDescription(string $description): RuleExecutionSetProperties
    {
        $this->description = $description;
        return $this;
    }

    public function getEntryFacts(): array
    {
        return $this->entryFacts;
    }

    public function setEntryFacts(array $entryFacts): RuleExecutionSetProperties
    {
        $this->entryFacts = $entryFacts;
        return $this;
    }

    public function getRuleType(): int
    {
        return $this->ruleType;
    }

    public function setRuleType(int $ruleType): RuleExecutionSetProperties
    {
        $this->ruleType = $ruleType;
        return $this;
    }

    public function getRuleGroup(): string
    {
        return $this->ruleGroup ?? '';
    }

    public function setRuleGroup(string $ruleGroup): RuleExecutionSetProperties
    {
        $this->ruleGroup = $ruleGroup;
        return $this;
    }

    public function getParserConfig(): ?ParserConfig
    {
        return $this->parserConfig;
    }

    public function setParserConfig(ParserConfig $parserConfig): RuleExecutionSetProperties
    {
        $this->parserConfig = $parserConfig;
        return $this;
    }

    public function getExecutableClasses(): array
    {
        return $this->executableClasses;
    }

    public function setExecutableClasses(array $executableClasses): RuleExecutionSetProperties
    {
        $this->executableClasses = $executableClasses;
        return $this;
    }

    public function getExecutableFunctions(): array
    {
        return $this->executableFunctions;
    }

    public function setExecutableFunctions(array $executableFunctions): RuleExecutionSetProperties
    {
        $this->executableFunctions = $executableFunctions;
        return $this;
    }

    public function getPlaceholders(): array
    {
        return $this->placeholders;
    }

    public function setPlaceholders(array $placeholders): RuleExecutionSetProperties
    {
        $this->placeholders = $placeholders;
        return $this;
    }

    public function isResolvePlaceholders(): bool
    {
        return $this->resolvePlaceholders;
    }

    public function setResolvePlaceholders(bool $resolvePlaceholders): RuleExecutionSetProperties
    {
        $this->resolvePlaceholders = $resolvePlaceholders;
        return $this;
    }

    public function getExecutableConstants(): array
    {
        return $this->executableConstants;
    }

    public function setExecutableConstants(array $executableConstants): self
    {
        $this->executableConstants = $executableConstants;
        return $this;
    }
}
