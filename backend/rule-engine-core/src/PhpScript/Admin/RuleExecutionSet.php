<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

use Dtyq\RuleEngineCore\PhpScript\PlaceholderProviderInterface;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use Dtyq\RuleEngineCore\Standards\Admin\RuleExecutionSetInterface;
use Dtyq\RuleEngineCore\Standards\Exception\InvalidRuleSessionException;
use Dtyq\RuleEngineCore\Standards\Exception\RuleExecutionSetCreateException;
use PhpParser\Node\Stmt;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use Throwable;

class RuleExecutionSet implements RuleExecutionSetInterface
{
    protected string $name;

    protected ?string $description = null;

    protected RuleExecutionSetProperties $properties;

    protected string $ruleGroup;

    protected array $originalRule = [];

    protected array $rules = [];

    protected array $preparedCodes = [];

    protected array $placeholders = [];

    protected array $entryFacts = [];

    protected bool $resolvePlaceholders = false;

    /** @var Stmt[][] */
    protected array $asts = [];

    protected bool $parsed = false;

    protected bool $replacedPlaceholder = false;

    protected PHPSandbox $phpSandBox;

    protected SandboxOptions $sandboxOptions;

    protected PlaceholderProviderInterface $placeholderProvider;

    public function __construct()
    {
    }

    public function jsonSerialize(): array
    {
        $json = [];
        foreach ($this as $key => $value) {
            $json[$key] = $value;
        }
        return $json;
    }

    public function getPlaceholders(): array
    {
        return $this->placeholders;
    }

    public function setName(string $name): RuleExecutionSet
    {
        $this->name = $name;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setDescription(?string $description): RuleExecutionSet
    {
        $this->description = $description;
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDefaultObjectFilter(string $objectFilterClassname): void
    {
        // TODO: Implement setDefaultObjectFilter() method.
    }

    public function getDefaultObjectFilter(): string
    {
        // TODO: Implement getDefaultObjectFilter() method.
        return '';
    }

    public function getOriginalRule(): array
    {
        return $this->originalRule;
    }

    public function setRules(array $rules): RuleExecutionSet
    {
        $this->rules = $rules;
        return $this;
    }

    public function getRules(): array
    {
        return $this->rules;
    }

    public function getRuleGroup(): string
    {
        return $this->ruleGroup;
    }

    public function getEntryFacts(): array
    {
        return $this->entryFacts;
    }

    public function isParsed(): bool
    {
        return $this->parsed;
    }

    public function getAsts(): array
    {
        return $this->asts;
    }

    public function setPlaceholderProvider(PlaceholderProviderInterface $placeholderProvider): RuleExecutionSet
    {
        $this->placeholderProvider = $placeholderProvider;
        return $this;
    }

    public function getProperties(): RuleExecutionSetProperties
    {
        return $this->properties;
    }

    public function create(mixed $input, RuleExecutionSetProperties $properties): void
    {
        if (empty($properties->getName())) {
            throw new RuleExecutionSetCreateException('Failed to create rule execution set:missing name', 1005000);
        }
        //        if (empty($properties['entryFacts'])) {
        //            throw new RuleExecutionSetCreateException('Failed to create rule execution set:missing entryFacts', 1005000);
        //        }
        if (empty($input)) {
            throw new RuleExecutionSetCreateException('Failed to create rule execution set:missing rules', 1005000);
        }

        $this->name = $properties->getName();
        $this->description = $properties->getDescription();
        $this->properties = $properties;
        $this->rules = $this->originalRule = is_array($input) ? $input : [$input];
        $this->ruleGroup = $properties->getRuleGroup();
        $this->placeholders = $properties->getPlaceholders();
        $this->entryFacts = $properties->getEntryFacts();
        $this->resolvePlaceholders = $properties->isResolvePlaceholders();
        $this->initSandBox($properties);

        if (RuleType::isExpression($properties->getRuleType())) {
            $this->buildRuleToExpression();
        }
        // 占位符解析
        if ($this->resolvePlaceholders) {
            $this->buildPlaceholders();
        }
        // 若不存在占位符则可以预先进行规则解析
        if (empty($this->placeholders)) {
            $this->parse();
        }
    }

    public function initSandBox(RuleExecutionSetProperties $properties): void
    {
        $this->sandboxOptions = new SandboxOptions();
        //        $this->phpSandBox = new PHPSandbox($sandboxOption);
        $parserConfig = $properties->getParserConfig();
        $allowAliases = false;
        foreach ($properties->getExecutableClasses() as $class) {
            $this->sandboxOptions->definitions()->defineClass($class->getShortName(), $class->getShortName());
            $this->sandboxOptions->accessControl()->whitelistAlias($class->getName());
            $this->sandboxOptions->accessControl()->whitelistType($class->getName());
            //            $this->phpSandBox->defineClass($class->getShortName(), $class->getShortName());
            //            $this->phpSandBox->whitelistAlias($class->getName());
            $allowAliases = true;
        }
        foreach ($properties->getExecutableFunctions() as $func) {
            if ($func->isWhiteLists()) {
                $this->sandboxOptions->accessControl()->whitelistFunc($func->getName());
                continue;
            }
            $this->sandboxOptions->definitions()->defineFunc($func->getName(), $func->getFunction());
            //            $this->phpSandBox->defineFunc($func->getName(), $func->getFunction());
        }

        // 定义常量 目前仅支持白名单
        foreach ($properties->getExecutableConstants() as $const) {
            if ($const->isSystemConstant()) {
                $this->sandboxOptions->accessControl()->whitelistConst($const->getConstantName());
                //                continue;
            }
            //            $this->sandboxOptions->definitions()->defineConst($const->getConstantName(), $const->getConstantValue());
        }

        $parserConfig && $this->sandboxOptions->setAllowClasses($parserConfig->isAllowDeclareClasses());
        $this->sandboxOptions->setAllowAliases($allowAliases);
        $this->phpSandBox = new PHPSandbox($this->sandboxOptions);
        //        $this->phpSandBox->allow_classes = $parserConfig->isAllowDeclareClasses();
        //        $this->phpSandBox->allow_aliases = $allowAliases;
    }

    public function execute(array $facts, array $placeholders): array
    {
        try {
            $res = [];
            $facts && $this->sandboxOptions->definitions()->defineVars($facts);
            //            $facts && $this->phpSandBox->defineVars($facts);
            //            $skipValidation = $this->isParsed();
            $this->replacePlaceholder($placeholders);

            foreach ($this->getRules() as $key => $code) {
                $this->phpSandBox->prepare($code);
                //                isset($this->preparedCodes[$key]) ? $this->phpSandBox->prepare($this->preparedCodes[$key], true) : $this->phpSandBox->prepare($code);
                //                $this->phpSandBox->prepare($skipValidation ? $this->preparedCodes[$key] : $code, $skipValidation);
                $res[$key] = $this->phpSandBox->execute();
            }
            return $res;
        } catch (Throwable $e) {
            throw new InvalidRuleSessionException('Rule execution failure', 1005005, $e);
        }
    }

    public function replacePlaceholder($placeholders): self
    {
        if (empty($this->getPlaceholders()) || $this->replacedPlaceholder) {
            return $this;
        }

        if (empty($placeholders)
           || array_diff_assoc($this->getPlaceholders(), array_keys($placeholders))) {
            throw new InvalidRuleSessionException('Rule execution failure:incorrect placeholder', 1005005);
        }
        try {
            $this->rules = $this->placeholderProvider->replace($this->getName(), $this->rules, $placeholders);
            $this->replacedPlaceholder = true;
        } catch (Throwable $e) {
            throw new InvalidRuleSessionException('Rule execution failure', 1005005, $e);
        }

        return $this;
    }

    public function parse(): self
    {
        try {
            foreach ($this->rules as $key => $code) {
                $this->phpSandBox->prepare($code);
                $this->preparedCodes[$key] = $this->phpSandBox->getPreparedCode();
                $this->asts[$key] = $this->phpSandBox->getParsedAST();
            }
            $this->parsed = true;
            return $this;
        } catch (Throwable $e) {
            throw new InvalidRuleSessionException('Rule parse failure', 1005005, $e);
        }
    }

    public function getPreparedCodes(): array
    {
        return $this->preparedCodes;
    }

    public function setPreparedCodes(array $preparedCodes): RuleExecutionSet
    {
        $this->preparedCodes = $preparedCodes;
        return $this;
    }

    private function buildPlaceholders(): void
    {
        try {
            $this->placeholders = $this->placeholderProvider->resolve($this->getRules());
        } catch (Throwable $e) {
            throw new RuleExecutionSetCreateException('Failed to create the rule execution set', 1005009, $e);
        }
    }

    private function buildRuleToExpression(): void
    {
        foreach ($this->rules as $key => $rule) {
            $this->rules[$key] = 'return ' . $rule . ';';
        }
    }
}
