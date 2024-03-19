<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Validation\Visitor;

use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use PHPSandbox\Validation\Validator;
use Throwable;

/**
 * Whitelister class for PHP Sandboxes.
 *
 * This class takes parsed AST code and checks it against the passed PHPSandbox instance configuration to
 * autmatically whitelist trusted code functions, classes, etc. if the appropriate settings are configured.
 *
 * @namespace PHPSandbox
 *
 * @version 3.0
 */
class WhitelistVisitor extends NodeVisitorAbstract
{
    //    /** The PHPSandbox instance to check against.
    //     */
    //    protected PHPSandbox $sandbox;

    protected SandboxOptions $options;

    protected Validator $validator;

    /** WhitelistVisitor class constructor.
     *
     * This constructor takes a passed PHPSandbox instance to check against for whitelisting trusted code.
     *
     * @param PHPSandbox $sandbox The PHPSandbox instance to check against
     */
    public function __construct(PHPSandbox $sandbox)
    {
        //        $this->sandbox = $sandbox;
        $this->options = $sandbox->getOptions();
        $this->validator = $sandbox->getValidator();
    }

    /** Examine the current PhpParser_Node node against the PHPSandbox configuration for whitelisting trusted code.
     *
     * @param Node $node The trusted $node to examine
     *
     * @return null|bool Return false if node must be removed, or null if no changes to the node are made
     * @throws Throwable
     */
    public function leaveNode(Node $node): ?bool
    {
        if ($node instanceof Node\Expr\FuncCall
            && $node->name instanceof Node\Name
            && ! $this->options->accessControl()->hasBlacklistedFuncs()
        ) {
            $this->options->accessControl()->whitelistFunc($node->name->toString());
        } elseif ($node instanceof Node\Stmt\Function_
            && $node->name instanceof Node\Identifier
            && ! $this->options->accessControl()->hasBlacklistedFuncs()
        ) {
            $this->options->accessControl()->whitelistFunc($node->name->toString());
        } elseif (($node instanceof Node\Expr\Variable || $node instanceof Node\Stmt\StaticVar)
            && is_string($node->name)
            && $this->options->accessControl()->hasWhitelistedVars()
            && ! $this->options->isAllowVariables()
        ) {
            $this->options->accessControl()->whitelistVar($node->name);
        } elseif ($node instanceof Node\Expr\FuncCall
            && $node->name instanceof Node\Name
            && $node->name->toString() === 'define'
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
        } elseif ($node instanceof Node\Expr\ConstFetch
            && $node->name instanceof Node\Name
            && ! $this->options->accessControl()->hasBlacklistedConsts()
        ) {
            $this->options->accessControl()->whitelistConst($node->name->toString());
        } elseif ($node instanceof Node\Stmt\Class_
            && $node->name instanceof Node\Identifier
            && ! $this->options->accessControl()->hasBlacklistedClasses()
        ) {
            $this->options->accessControl()->whitelistClass($node->name->toString());
        } elseif ($node instanceof Node\Stmt\Interface_
            && is_string($node->name)
            && ! $this->options->accessControl()->hasBlacklistedInterfaces()
        ) {
            $this->options->accessControl()->whitelistInterface($node->name);
        } elseif ($node instanceof Node\Stmt\Trait_
            && is_string($node->name)
            && ! $this->options->accessControl()->hasBlacklistedTraits()
        ) {
            $this->options->accessControl()->whitelistTrait($node->name);
        } elseif ($node instanceof Node\Expr\New_
            && $node->class instanceof Node\Name
            && ! $this->options->accessControl()->hasBlacklistedTypes()
        ) {
            $this->options->accessControl()->whitelistType($node->class->toString());
        } elseif ($node instanceof Node\Stmt\Global_
            && $this->options->accessControl()->hasWhitelistedVars()
        ) {
            foreach ($node->vars as $var) {
                if ($var instanceof Node\Expr\Variable) {
                    $this->options->accessControl()->whitelistVar($var->name);
                }
            }
        } elseif ($node instanceof Node\Stmt\Namespace_) {
            if ($node->name instanceof Node\Name) {
                $name = $node->name->toString();
                $this->validator->checkNamespace($name);
                if (! $this->options->definitions()->isDefinedNamespace($name)) {
                    $this->options->definitions()->defineNamespace($name);
                }
            }
            return (bool) NodeTraverser::REMOVE_NODE;
        } elseif ($node instanceof Node\Stmt\Use_) {
            foreach ($node->uses as $use) {
                if ($use instanceof Node\Stmt\UseUse
                    && $use->name instanceof Node\Name
                    && (is_string($use->alias) || is_null($use->alias))
                ) {
                    $name = $use->name->toString();
                    $this->validator->checkAlias($name);
                    if (! $this->options->definitions()->isDefinedAlias($name)) {
                        $this->options->definitions()->defineAlias($name, $use->alias);
                    }
                }
            }
            return (bool) NodeTraverser::REMOVE_NODE;
        }
        return null;
    }
}
