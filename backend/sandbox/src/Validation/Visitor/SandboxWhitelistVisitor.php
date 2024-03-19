<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Validation\Visitor;

use PhpParser\Node;
use PhpParser\NodeVisitorAbstract;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;

/**
 * SandboxWhitelister class for PHP Sandboxes.
 *
 * This class takes parsed AST code and checks it against the passed PHPSandbox instance configuration to
 * autmatically whitelist sandboxed code functions, classes, etc. if the appropriate settings are configured.
 *
 * @namespace PHPSandbox
 *
 * @version 3.0
 */
class SandboxWhitelistVisitor extends NodeVisitorAbstract
{
    /** The PHPSandbox instance to check against.
     */
    //    protected PHPSandbox $sandbox;

    protected SandboxOptions $options;

    /** SandboxWhitelistVisitor class constructor.
     *
     * This constructor takes a passed PHPSandbox instance to check against for whitelisting sandboxed code.
     *
     * @param PHPSandbox $sandbox The PHPSandbox instance to check against
     */
    public function __construct(PHPSandbox $sandbox)
    {
        //        $this->sandbox = $sandbox;
        $this->options = $sandbox->getOptions();
    }

    /** Examine the current PhpParser\Node node against the PHPSandbox configuration for whitelisting sandboxed code.
     *
     * @param Node $node The sandboxed $node to examine
     */
    public function leaveNode(Node $node)
    {
        if ($node instanceof Node\Stmt\Class_
            && $node->name instanceof Node\Identifier
            && $this->options->isAllowClasses()
            && $this->options->isAutoWhitelistClasses() && ! $this->options->accessControl()->hasBlacklistedClasses()
        ) {
            $this->options->accessControl()->whitelistClass($node->name->toString());
            $this->options->accessControl()->whitelistType($node->name->toString());
        } elseif ($node instanceof Node\Stmt\Interface_
            && (is_string($node->name) || $node->name instanceof Node\Identifier)
            && $this->options->isAllowInterfaces()
            && $this->options->isAutoWhitelistInterfaces()
            && ! $this->options->accessControl()->hasBlacklistedInterfaces()
        ) {
            $this->options->accessControl()->whitelistInterface($node->name);
        } elseif ($node instanceof Node\Stmt\Trait_
            && (is_string($node->name) || $node->name instanceof Node\Identifier)
            && $this->options->isAllowTraits()
            && $this->options->isAutoWhitelistTraits()
            && ! $this->options->accessControl()->hasBlacklistedTraits()
        ) {
            $this->options->accessControl()->whitelistTrait($node->name);
        } elseif ($node instanceof Node\Expr\FuncCall
            && $node->name instanceof Node\Name
            && $node->name->toString() === 'define'
            && $this->options->isAllowConstants()
            && $this->options->isAutoWhitelistConstants()
            && ! $this->options->definitions()->isDefinedFunc('define')
            && ! $this->options->accessControl()->hasBlacklistedConsts()
        ) {
            $name = $node->args[0] ?? null;
            if ($name instanceof Node\Arg
                && $name->value instanceof Node\Scalar\String_
                && is_string($name->value->value)
                && $name->value->value
            ) {
                $this->options->accessControl()->whitelistConst($name->value->value);
            }
        } elseif ($node instanceof Node\Stmt\Global_
            && $this->options->isAllowGlobals()
            && $this->options->isAutoWhitelistGlobals()
            && $this->options->accessControl()->hasWhitelistedVars()
        ) {
            foreach ($node->vars as $var) {
                if ($var instanceof Node\Expr\Variable) {
                    $this->options->accessControl()->whitelistVar($var->name);
                }
            }
        } elseif ($node instanceof Node\Stmt\Function_
            && $node->name instanceof Node\Identifier
            && $this->options->isAllowFunctions()
            && $this->options->isAutoWhitelistFunctions()
            && ! $this->options->accessControl()->hasBlacklistedFuncs()
        ) {
            $this->options->accessControl()->whitelistFunc($node->name->toString());
        }
    }
}
