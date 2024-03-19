<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Validation\Visitor;

use PhpParser\BuilderFactory;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;
use PHPSandbox\Error;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use PHPSandbox\Runtime\Proxy\ArgFunctions;
use PHPSandbox\Runtime\Proxy\DefinedFunctions;
use PHPSandbox\Runtime\Proxy\SandboxedStringFunctions;
use PHPSandbox\Runtime\Proxy\Superglobals;
use PHPSandbox\Runtime\RuntimeProxy;
use PHPSandbox\Validation\Validator;
use Throwable;

/**
 * Validator class for PHP Sandboxes.
 *
 * This class takes parsed AST code and checks it against the passed PHPSandbox instance
 * configuration for errors, and throws exceptions if they are found
 *
 * @namespace PHPSandbox
 *
 * @version 3.0
 */
class ValidatorVisitor extends NodeVisitorAbstract
{
    /** The PHPSandbox instance to check against.
     */
    protected PHPSandbox $sandbox;

    protected SandboxOptions $options;

    protected Validator $validator;

    protected RuntimeProxy $runtimeProxy;

    protected BuilderFactory $builderFactory;

    /** ValidatorVisitor class constructor.
     *
     * This constructor takes a passed PHPSandbox instance to check against for validating sandboxed code.
     *
     * @param PHPSandbox $sandbox The PHPSandbox instance to check against
     */
    public function __construct(PHPSandbox $sandbox)
    {
        $this->sandbox = $sandbox;
        $this->options = $sandbox->getOptions();
        $this->validator = $sandbox->getValidator();
        $this->runtimeProxy = $sandbox->getRuntimeProxy();
        $this->builderFactory = new BuilderFactory();
    }

    /** Examine the current PhpParser_Node node against the PHPSandbox configuration for validating sandboxed code.
     *
     * @param Node $node The sandboxed $node to validate
     *
     * @return mixed Return rewritten node, false if node must be removed, or null if no changes to the node are made
     * @throws Throwable Throws an exception if validation fails
     */
    public function leaveNode(Node $node): mixed
    {
        //        $sandboxInnerVariable = '_sandbox_';
        if ($node instanceof Node\Arg && $this->sandbox->options->isSandboxStrings()) {
            //            return new Node\Expr\FuncCall(new Node\Name\FullyQualified(($node->value instanceof Node\Expr\Variable) ? 'PHPSandbox\\wrapByRef' : 'PHPSandbox\\wrap'), [$node, new Node\Expr\Variable($sandboxInnerVariable)], $node->getAttributes());
            return new Node\Expr\FuncCall(new Node\Name\FullyQualified(($node->value instanceof Node\Expr\Variable) ? 'PHPSandbox\wrapByRef' : 'PHPSandbox\wrap'), [$node, $this->buildRuntimeContainerNode()], $node->getAttributes());
        }
        if ($node instanceof Node\Stmt\InlineHTML) {
            if (! $this->options->isAllowEscaping()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to escape to HTML!', Error::ESCAPE_ERROR, $node);
            }
        } elseif ($node instanceof Node\Expr\Cast) {
            if (! $this->options->isAllowCasting()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to cast!', Error::CAST_ERROR, $node);
            }
            if ($node instanceof Node\Expr\Cast\Int_) {
                //                return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_intval', [new Node\Arg($node->expr)], $node->getAttributes());
                return $this->builderFactory->methodCall($this->buildSandboxedStringFunctionsNode(), '_intval', $this->builderFactory->args([$node->expr]));
            }
            if ($node instanceof Node\Expr\Cast\Double) {
                //                return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_floatval', [new Node\Arg($node->expr)], $node->getAttributes());
                return $this->builderFactory->methodCall($this->buildSandboxedStringFunctionsNode(), '_floatval', $this->builderFactory->args([$node->expr]));
            }
            if ($node instanceof Node\Expr\Cast\Bool_) {
                //                return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_boolval', [new Node\Arg($node->expr)], $node->getAttributes());
                return $this->builderFactory->methodCall($this->buildSandboxedStringFunctionsNode(), '_boolval', $this->builderFactory->args([$node->expr]));
            }
            if ($node instanceof Node\Expr\Cast\Array_) {
                //                return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_arrayval', [new Node\Arg($node->expr)], $node->getAttributes());
                return $this->builderFactory->methodCall($this->buildSandboxedStringFunctionsNode(), '_arrayval', $this->builderFactory->args([$node->expr]));
            }
            if ($node instanceof Node\Expr\Cast\Object_) {
                //                return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_objectval', [new Node\Arg($node->expr)], $node->getAttributes());
                return $this->builderFactory->methodCall($this->buildSandboxedStringFunctionsNode(), '_objectval', $this->builderFactory->args([$node->expr]));
            }
        } elseif ($node instanceof Node\Expr\FuncCall) {
            if ($node->name instanceof Node\Name) {
                $name = strtolower($node->name->toString());
                if (! $this->validator->checkFunc($name)) {
                    $this->sandbox->error->validationError('Function failed custom validation!', Error::VALID_FUNC_ERROR, $node);
                }
                if ($this->options->definitions()->isDefinedFunc($name)) {
                    $args = $node->args;
                    array_unshift($args, new Node\Arg(new Node\Scalar\String_($name)));
                    //                    return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), 'call_func', $args, $node->getAttributes());
                    return $this->builderFactory->methodCall($this->buildRuntimeContainerNode(), 'call_func', $args);
                }
                if ($this->options->isOverwriteDefinedFuncs() && DefinedFunctions::isDefinedFunc($name)) {
                    //                    return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_' . $name, [new Node\Arg(new Node\Expr\FuncCall(new Node\Name([$name])))], $node->getAttributes());
                    return $this->builderFactory->methodCall(
                        $this->buildDefinedFunctionsNode(),
                        '_' . $name,
                        $this->builderFactory->args([
                            $this->builderFactory->funcCall($name),
                        ])
                    );
                }
                if ($this->options->isOverwriteSandboxedStringFuncs() && SandboxedStringFunctions::isSandboxedStringFuncs($name)) {
                    $args = $node->args;
                    //                    return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_' . $name, $args, $node->getAttributes());
                    return $this->builderFactory->methodCall(
                        $this->buildSandboxedStringFunctionsNode(),
                        '_' . $name,
                        $args
                    );
                }
                if ($this->options->isOverwriteFuncGetArgs() && ArgFunctions::isArgFuncs($name)) {
                    if ($name === 'func_get_arg') {
                        $index = new Node\Arg(new Node\Scalar\LNumber(0));
                        if (isset($node->args[0]) && $node->args[0] instanceof Node\Arg) {
                            $index = $node->args[0];
                        } elseif (isset($node->args[0]->args[0]) && $node->args[0] instanceof Node\Expr\FuncCall && $node->args[0]->args[0]) {
                            $index = $node->args[0]->args[0];
                        }
                        //                        return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_' . $name, [new Node\Arg(new Node\Expr\FuncCall(new Node\Name(['func_get_args']))), $index], $node->getAttributes());
                        return $this->builderFactory->methodCall(
                            $this->buildArgFunctionsNode(),
                            '_' . $name,
                            $this->builderFactory->args([$this->builderFactory->funcCall('func_get_args'), $index])
                        );
                    }
                    //                    return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_' . $name, [new Node\Arg(new Node\Expr\FuncCall(new Node\Name(['func_get_args'])))], $node->getAttributes());
                    return $this->builderFactory->methodCall(
                        $this->buildArgFunctionsNode(),
                        '_' . $name,
                        $this->builderFactory->args([$this->builderFactory->funcCall('func_get_args')])
                    );
                }
            } else {
                //                return new Node\Expr\Ternary(
                //                    new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), 'checkFunc', [new Node\Arg($node->name)], $node->getAttributes()),
                //                    $node,
                //                    new Node\Expr\ConstFetch(new Node\Name('null'))
                //                );
                return new Node\Expr\Ternary(
                    $this->builderFactory->methodCall($this->buildValidatorNode(), 'checkFunc', $this->builderFactory->args([$node->name])),
                    $node,
                    new Node\Expr\ConstFetch(new Node\Name('null'))
                );
            }
        } elseif ($node instanceof Node\Stmt\Function_) {
            if (! $this->options->isAllowFunctions()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define function!', Error::DEFINE_FUNC_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('function')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'function');
            }
            if (! $node->name) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define unnamed function!', Error::DEFINE_FUNC_ERROR, $node, '');
            }
            if ($this->options->definitions()->isDefinedFunc($node->name)) {
                $this->sandbox->error->validationError('Sandboxed code attempted to redefine function!', Error::DEFINE_FUNC_ERROR, $node, $node->name);
            }
            if ($node->byRef && ! $this->options->isAllowReferences()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define function return by reference!', Error::BYREF_ERROR, $node);
            }
        } elseif ($node instanceof Node\Expr\Closure) {
            if (! $this->options->isAllowClosures()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to create a closure!', Error::CLOSURE_ERROR, $node);
            }
        } elseif ($node instanceof Node\Stmt\Class_) {
            if (! $this->options->isAllowClasses()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define class!', Error::DEFINE_CLASS_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('class')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'class');
            }
            if (! $node->name) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define unnamed class!', Error::DEFINE_CLASS_ERROR, $node, '');
            }
            if (! $this->validator->checkClass($node->name->toString())) {
                $this->sandbox->error->validationError('Class failed custom validation!', Error::VALID_CLASS_ERROR, $node, $node->name);
            }
            if ($node->extends instanceof Node\Name) {
                if (! $this->validator->checkKeyword('extends')) {
                    $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'extends');
                }
                if (! $node->extends->toString()) {
                    $this->sandbox->error->validationError('Sandboxed code attempted to extend unnamed class!', Error::DEFINE_CLASS_ERROR, $node, '');
                }
                if (! $this->validator->checkClass($node->extends->toString(), true)) {
                    $this->sandbox->error->validationError('Class extension failed custom validation!', Error::VALID_CLASS_ERROR, $node, $node->extends->toString());
                }
            }
            if (is_array($node->implements)) {
                if (! $this->validator->checkKeyword('implements')) {
                    $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'implements');
                }
                foreach ($node->implements as $implement) {
                    /**
                     * @var Node\Name $implement
                     */
                    if (! $implement->toString()) {
                        $this->sandbox->error->validationError('Sandboxed code attempted to implement unnamed interface!', Error::DEFINE_INTERFACE_ERROR, $node, '');
                    }
                    if (! $this->validator->checkInterface($implement->toString())) {
                        $this->sandbox->error->validationError('Interface failed custom validation!', Error::VALID_INTERFACE_ERROR, $node, $implement->toString());
                    }
                }
            }
        } elseif ($node instanceof Node\Stmt\Interface_) {
            if (! $this->options->isAllowInterfaces()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define interface!', Error::DEFINE_INTERFACE_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('interface')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'interface');
            }
            if (! $node->name) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define unnamed interface!', Error::DEFINE_INTERFACE_ERROR, $node, '');
            }
            if (! $this->validator->checkInterface($node->name)) {
                $this->sandbox->error->validationError('Interface failed custom validation!', Error::VALID_INTERFACE_ERROR, $node, $node->name);
            }
        } elseif ($node instanceof Node\Stmt\Trait_) {
            if (! $this->options->isAllowTraits()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define trait!', Error::DEFINE_TRAIT_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('trait')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'trait');
            }
            if (! $node->name) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define unnamed trait!', Error::DEFINE_TRAIT_ERROR, $node, '');
            }
            if (! $this->validator->checkTrait($node->name)) {
                $this->sandbox->error->validationError('Trait failed custom validation!', Error::VALID_TRAIT_ERROR, $node, $node->name);
            }
        } elseif ($node instanceof Node\Stmt\TraitUse) {
            if (! $this->validator->checkKeyword('use')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'use');
            }
            if (is_array($node->traits)) {
                foreach ($node->traits as $trait) {
                    /**
                     * @var Node\Name $trait
                     */
                    if (! $trait->toString()) {
                        $this->sandbox->error->validationError('Sandboxed code attempted to use unnamed trait!', Error::DEFINE_TRAIT_ERROR, $node, '');
                    }
                    if (! $this->validator->checkTrait($trait->toString())) {
                        $this->sandbox->error->validationError('Trait failed custom validation!', Error::VALID_TRAIT_ERROR, $node, $trait->toString());
                    }
                }
            }
        } elseif ($node instanceof Node\Expr\Yield_) {
            if (! $this->options->isAllowGenerators()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to create a generator!', Error::GENERATOR_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('yield')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'yield');
            }
        } elseif ($node instanceof Node\Stmt\Global_) {
            if (! $this->options->isAllowGlobals()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to use global keyword!', Error::GLOBALS_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('global')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'global');
            }
            foreach ($node->vars as $var) {
                /**
                 * @var Node\Expr\Variable $var
                 */
                if ($var instanceof Node\Expr\Variable) {
                    if (! $this->validator->checkGlobal($var->name)) {
                        $this->sandbox->error->validationError('Global failed custom validation!', Error::VALID_GLOBAL_ERROR, $node, $var->name);
                    }
                } else {
                    $this->sandbox->error->validationError('Sandboxed code attempted to pass non-variable to global keyword!', Error::DEFINE_GLOBAL_ERROR, $node);
                }
            }
        } elseif ($node instanceof Node\Expr\Variable) {
            if (! is_string($node->name)) {
                $this->sandbox->error->validationError('Sandboxed code attempted dynamically-named variable call!', Error::DYNAMIC_VAR_ERROR, $node);
            }
            //            if (in_array($node->name, PHPSandbox::$inner_variable)) {
            //                $this->sandbox->error->validationError('Sandboxed code attempted to access the PHPSandbox inner variable!', Error::SANDBOX_ACCESS_ERROR, $node);
            //            }
            if (in_array($node->name, Superglobals::$superglobals)) {
                if (! $this->validator->checkSuperglobal($node->name)) {
                    $this->sandbox->error->validationError('Superglobal failed custom validation!', Error::VALID_SUPERGLOBAL_ERROR, $node, $node->name);
                }
                if ($this->options->isOverwriteSuperglobals()) {
                    //                    return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_get_superglobal', [new Node\Arg(new Node\Scalar\String_($node->name))], $node->getAttributes());
                    return $this->builderFactory->methodCall(
                        $this->builderFactory->methodCall($this->buildRuntimeContainerNode(), 'superglobals'),
                        '_get_superglobal',
                        [new Node\Arg(new Node\Scalar\String_($node->name))]
                    );
                }
            } else {
                if (! $this->validator->checkVar($node->name)) {
                    $this->sandbox->error->validationError('Variable failed custom validation!', Error::VALID_VAR_ERROR, $node, $node->name);
                }
            }
        } elseif ($node instanceof Node\Stmt\StaticVar) {
            if (! $this->sandbox->options->isAllowStaticVariables()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to create static variable!', Error::STATIC_VAR_ERROR, $node);
            }
            if (! is_string($node->var->name)) {
                $this->sandbox->error->validationError('Sandboxed code attempted dynamically-named static variable call!', Error::DYNAMIC_STATIC_VAR_ERROR, $node);
            }
            if (! $this->validator->checkVar($node->var->name)) {
                $this->sandbox->error->validationError('Variable failed custom validation!', Error::VALID_VAR_ERROR, $node, $node->var->name);
            }
            if ($node->default instanceof Node\Expr\New_) {
                $node->default = $node->default->args[0];
            }
        } elseif ($node instanceof Node\Stmt\Const_) {
            $this->sandbox->error->validationError('Sandboxed code cannot use const keyword in the global scope!', Error::GLOBAL_CONST_ERROR, $node);
        } elseif ($node instanceof Node\Expr\ConstFetch) {
            if (! $node->name instanceof Node\Name) {
                $this->sandbox->error->validationError('Sandboxed code attempted dynamically-named constant call!', Error::DYNAMIC_CONST_ERROR, $node);
            }
            if (! $this->validator->checkConst($node->name->toString())) {
                $this->sandbox->error->validationError('Constant failed custom validation!', Error::VALID_CONST_ERROR, $node, $node->name->toString());
            }
        } elseif ($node instanceof Node\Expr\ClassConstFetch || $node instanceof Node\Expr\StaticCall || $node instanceof Node\Expr\StaticPropertyFetch) {
            $class = $node->class;
            if (! $class instanceof Node\Name) {
                $this->sandbox->error->validationError('Sandboxed code attempted dynamically-named class call!', Error::DYNAMIC_CLASS_ERROR, $node);
            }
            if ($this->options->definitions()->isDefinedClass($class)) {
                $node->class = new Node\Name($this->options->definitions()->getDefinedClass($class));
            }
            /**
             * @var Node\Name $class
             */
            if (! $this->validator->checkClass($class->toString())) {
                $this->sandbox->error->validationError('Class constant failed custom validation!', Error::VALID_CLASS_ERROR, $node, $class->toString());
            }
            return $node;
        } elseif ($node instanceof Node\Param && $node->type instanceof Node\Name) {
            $class = $node->type->toString();
            if ($this->options->definitions()->isDefinedClass($class)) {
                $node->type = new Node\Name($this->options->definitions()->getDefinedClass($class));
            }
            return $node;
        } elseif ($node instanceof Node\Expr\New_) {
            if (! $this->options->isAllowObjects()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to create object!', Error::CREATE_OBJECT_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('new')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'new');
            }
            if (! $node->class instanceof Node\Name) {
                $this->sandbox->error->validationError('Sandboxed code attempted dynamically-named class call!', Error::DYNAMIC_CLASS_ERROR, $node);
            }
            $class = $node->class->toString();
            if ($this->options->definitions()->isDefinedClass($class)) {
                $node->class = new Node\Name($this->options->definitions()->getDefinedClass($class));
            }
            $this->validator->checkType($class);
            return $node;
        } elseif ($node instanceof Node\Expr\ErrorSuppress) {
            if (! $this->options->isAllowErrorSuppressing()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to suppress error!', Error::ERROR_SUPPRESS_ERROR, $node);
            }
        } elseif ($node instanceof Node\Expr\AssignRef) {
            if (! $this->options->isAllowReferences()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to assign by reference!', Error::BYREF_ERROR, $node);
            }
        } elseif ($node instanceof Node\Stmt\HaltCompiler) {
            if (! $this->options->isAllowHalting()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to halt compiler!', Error::HALT_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('halt')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'halt');
            }
        } elseif ($node instanceof Node\Stmt\Namespace_) {
            if (! $this->options->isAllowNamespaces()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to define namespace!', Error::DEFINE_NAMESPACE_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('namespace')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'namespace');
            }
            if ($node->name instanceof Node\Name) {
                $namespace = $node->name->toString();
                $this->validator->checkNamespace($namespace);
                if (! $this->options->definitions()->isDefinedNamespace($namespace)) {
                    $this->options->definitions()->defineNamespace($namespace);
                }
            } else {
                $this->sandbox->error->validationError('Sandboxed code attempted use invalid namespace!', Error::DEFINE_NAMESPACE_ERROR, $node);
            }
            return $node->stmts;
        } elseif ($node instanceof Node\Stmt\Use_) {
            if (! $this->options->isAllowAliases()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to use namespace and/or alias!', Error::DEFINE_ALIAS_ERROR, $node);
            }
            if (! $this->validator->checkKeyword('use')) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'use');
            }
            foreach ($node->uses as $use) {
                /**
                 * @var Node\Stmt\UseUse $use
                 */
                if ($use instanceof Node\Stmt\UseUse && $use->name instanceof Node\Name && (is_string($use->alias) || $use->alias instanceof Node\Identifier || is_null($use->alias))) {
                    $this->validator->checkAlias($use->name->toString());
                    if ($use->alias) {
                        if (! $this->validator->checkKeyword('as')) {
                            $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, 'as');
                        }
                    }
                    $this->options->accessControl()->whitelistClass($use->getAlias());
                    $this->options->accessControl()->whitelistType($use->getAlias());
                    $this->options->definitions()->defineAlias($use->name->toString(), $use->getAlias());
                } else {
                    $this->sandbox->error->validationError('Sandboxed code attempted use invalid namespace or alias!', Error::DEFINE_ALIAS_ERROR, $node);
                }
            }
            return NodeTraverser::REMOVE_NODE;
        } elseif ($node instanceof Node\Expr\ShellExec) {
            if ($this->options->definitions()->isDefinedFunc('shell_exec')) {
                // @fixme:源码此处貌似有 bug，未修复
                $args = [
                    new Node\Arg(new Node\Scalar\String_('shell_exec')),
                    new Node\Arg(new Node\Scalar\String_(implode('', $node->parts))),
                ];
                //                return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), 'call_func', $args, $node->getAttributes());
                return $this->builderFactory->methodCall($this->buildRuntimeContainerNode(), 'call_func', $args);
            }
            if ($this->options->accessControl()->hasWhitelistedFuncs()) {
                if (! $this->options->accessControl()->isWhitelistedFunc('shell_exec')) {
                    $this->sandbox->error->validationError('Sandboxed code attempted to use shell execution backticks when the shell_exec function is not whitelisted!', Error::BACKTICKS_ERROR, $node);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedFuncs() && $this->sandbox->accessControl->isBlacklistedFunc('shell_exec')) {
                $this->sandbox->error->validationError('Sandboxed code attempted to use shell execution backticks when the shell_exec function is blacklisted!', Error::BACKTICKS_ERROR, $node);
            }
            if (! $this->options->isAllowBackticks()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to use shell execution backticks!', Error::BACKTICKS_ERROR, $node);
            }
        } elseif ($name = $this->isMagicConst($node)) {
            if (! $this->validator->checkMagicConst($name)) {
                $this->sandbox->error->validationError('Magic constant failed custom validation!', Error::VALID_MAGIC_CONST_ERROR, $node, $name);
            }
            if ($this->options->definitions()->isDefinedMagicConst($name)) {
                //                return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_get_magic_const', [new Node\Arg(new Node\Scalar\String_($name))], $node->getAttributes());
                return $this->builderFactory->methodCall(
                    $this->builderFactory->methodCall($this->buildRuntimeContainerNode(), 'magicConstants'),
                    '_get_magic_const',
                    [new Node\Arg(new Node\Scalar\String_($name))]
                );
            }
            if (($filepath = $this->sandbox->getExecutingFile()) && in_array($name, ['__DIR__', '__FILE__'], true)) {
                return new Node\Scalar\String_($name === '__DIR__' ? dirname($filepath) : $filepath);
            }
        } elseif ($name = $this->isKeyword($node)) {
            if (! $this->validator->checkKeyword($name)) {
                $this->sandbox->error->validationError('Keyword failed custom validation!', Error::VALID_KEYWORD_ERROR, $node, $name);
            }
            if ($node instanceof Node\Expr\Include_ && ! $this->options->isAllowIncludes()) {
                $this->sandbox->error->validationError('Sandboxed code attempted to include files!', Error::INCLUDE_ERROR, $node, $name);
            } elseif ($node instanceof Node\Expr\Include_
                && (
                    ($node->type == Node\Expr\Include_::TYPE_INCLUDE && $this->options->definitions()->isDefinedFunc('include'))
                    || ($node->type == Node\Expr\Include_::TYPE_INCLUDE_ONCE && $this->options->definitions()->isDefinedFunc('include_once'))
                    || ($node->type == Node\Expr\Include_::TYPE_REQUIRE && $this->options->definitions()->isDefinedFunc('require'))
                    || ($node->type == Node\Expr\Include_::TYPE_REQUIRE_ONCE && $this->options->definitions()->isDefinedFunc('require_once'))
                )
            ) {
                //                return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), 'call_func', [new Node\Arg(new Node\Scalar\String_($name)), new Node\Arg($node->expr)], $node->getAttributes());
                return $this->builderFactory->methodCall($this->buildRuntimeContainerNode(), 'call_func', [new Node\Arg(new Node\Scalar\String_($name)), new Node\Arg($node->expr)]);
            } elseif ($node instanceof Node\Expr\Include_ && $this->options->isSandboxIncludes()) {
                // 暂时不允许使用内部 include 命令
                $this->sandbox->error->validationError('Sandboxed code attempted to include files!', Error::INCLUDE_ERROR, $node, $name);
                //                switch ($node->type) {
                //                    case Node\Expr\Include_::TYPE_INCLUDE_ONCE:
                //                        return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_include_once', [new Node\Arg($node->expr)], $node->getAttributes());
                //                    case Node\Expr\Include_::TYPE_REQUIRE:
                //                        return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_require', [new Node\Arg($node->expr)], $node->getAttributes());
                //                    case Node\Expr\Include_::TYPE_REQUIRE_ONCE:
                //                        return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_require_once', [new Node\Arg($node->expr)], $node->getAttributes());
                //                    case Node\Expr\Include_::TYPE_INCLUDE:
                //                    default:
                //                        return new Node\Expr\MethodCall(new Node\Expr\Variable($sandboxInnerVariable), '_include', [new Node\Arg($node->expr)], $node->getAttributes());
                //                }
            }
        } elseif ($name = $this->isOperator($node)) {
            if (! $this->validator->checkOperator($name)) {
                $this->sandbox->error->validationError('Operator failed custom validation!', Error::VALID_OPERATOR_ERROR, $node, $name);
            }
        } elseif ($name = $this->isPrimitive($node)) {
            if (! $this->validator->checkPrimitive($name)) {
                $this->sandbox->error->validationError('Primitive failed custom validation!', Error::VALID_PRIMITIVE_ERROR, $node, $name);
            }
        }
        return null;
    }

    /** Test the current PhpParser_Node node to see if it is a magic constant, and return the name if it is and null if it is not.
     *
     * @param Node $node The sandboxed $node to test
     *
     * @return null|string Return string name of node, or null if it is not a magic constant
     */
    protected function isMagicConst(Node $node): ?string
    {
        return ($node instanceof Node\Scalar\MagicConst) ? $node->getName() : null;
    }

    /** Test the current PhpParser_Node node to see if it is a keyword, and return the name if it is and null if it is not.
     *
     * @param Node $node The sandboxed $node to test
     *
     * @return null|string Return string name of node, or null if it is not a keyword
     */
    protected function isKeyword(Node $node): ?string
    {
        switch ($node->getType()) {
            case 'Expr_Eval':
                return 'eval';
            case 'Expr_Exit':
                return 'exit';
            case 'Expr_Include':
                return 'include';
            case 'Stmt_Echo':
            case 'Expr_Print':  // for our purposes print is treated as functionally equivalent to echo
                return 'echo';
            case 'Expr_Clone':
                return 'clone';
            case 'Expr_Empty':
                return 'empty';
            case 'Expr_Yield':
                return 'yield';
            case 'Stmt_Goto':
            case 'Stmt_Label':  // no point in using labels without goto
                return 'goto';
            case 'Stmt_If':
            case 'Stmt_Else':    // no point in using ifs without else
            case 'Stmt_ElseIf':  // no point in using ifs without elseif
                return 'if';
            case 'Stmt_Break':
                return 'break';
            case 'Stmt_Switch':
            case 'Stmt_Case':    // no point in using cases without switch
                return 'switch';
            case 'Stmt_Try':
            case 'Stmt_Catch':    // no point in using catch without try
            case 'Stmt_TryCatch': // no point in using try, catch or finally without try
                return 'try';
            case 'Stmt_Throw':
                return 'throw';
            case 'Stmt_Unset':
                return 'unset';
            case 'Stmt_Return':
                return 'return';
            case 'Stmt_Static':
                return 'static';
            case 'Stmt_While':
            case 'Stmt_Do':       // no point in using do without while
                return 'while';
            case 'Stmt_Declare':
            case 'Stmt_DeclareDeclare': // no point in using declare key=>value without declare
                return 'declare';
            case 'Stmt_For':
            case 'Stmt_Foreach':  // no point in using foreach without for
                return 'for';
            case 'Expr_Instanceof':
                return 'instanceof';
            case 'Expr_Isset':
                return 'isset';
            case 'Expr_List':
                return 'list';
        }
        return null;
    }

    /** Test the current PhpParser_Node node to see if it is an operator, and return the name if it is and null if it is not.
     *
     * @param Node $node The sandboxed $node to test
     *
     * @return null|string Return string name of node, or null if it is not an operator
     */
    protected function isOperator(Node $node): ?string
    {
        switch ($node->getType()) {
            case 'Expr_Assign':
                return '=';
            case 'Expr_AssignBitwiseAnd':
                return '&=';
            case 'Expr_AssignBitwiseOr':
                return '|=';
            case 'Expr_AssignBitwiseXor':
                return '^=';
            case 'Expr_AssignConcat':
                return '.=';
            case 'Expr_AssignDiv':
                return '/=';
            case 'Expr_AssignMinus':
                return '-=';
            case 'Expr_AssignMod':
                return '%=';
            case 'Expr_AssignMul':
                return '*=';
            case 'Expr_AssignPlus':
                return '+=';
            case 'Expr_AssignRef':
                return '=&';
            case 'Expr_AssignShiftLeft':
                return '<<=';
            case 'Expr_AssignShiftRight':
                return '>>=';
            case 'Expr_BitwiseAnd':
                return '&';
            case 'Expr_BitwiseNot':
                return '~';
            case 'Expr_BitwiseOr':
                return '|';
            case 'Expr_BitwiseXor':
                return '^';
            case 'Expr_BooleanAnd':
                return '&&';
            case 'Expr_BooleanNot':
                return '!';
            case 'Expr_BooleanOr':
                return '||';
            case 'Expr_Concat':
                return '.';
            case 'Expr_Div':
                return '/';
            case 'Expr_Equal':
                return '==';
            case 'Expr_Greater':
                return '>';
            case 'Expr_GreaterOrEqual':
                return '>=';
            case 'Expr_Identical':
                return '===';
            case 'Expr_LogicalAnd':
                return 'and';
            case 'Expr_LogicalOr':
                return 'or';
            case 'Expr_LogicalXor':
                return 'xor';
            case 'Expr_Minus':
                return '-';
            case 'Expr_Mod':
                return '%';
            case 'Expr_Mul':
                return '*';
            case 'Expr_NotEqual':
                return '!=';
            case 'Expr_NotIdentical':
                return '!==';
            case 'Expr_Plus':
                return '+';
            case 'Expr_PostDec':
                return 'n--';
            case 'Expr_PostInc':
                return 'n++';
            case 'Expr_PreDec':
                return '--n';
            case 'Expr_PreInc':
                return '++n';
            case 'Expr_ShiftLeft':
                return '<<';
            case 'Expr_ShiftRight':
                return '>>';
            case 'Expr_Smaller':
                return '<';
            case 'Expr_SmallerOrEqual':
                return '<=';
            case 'Expr_Ternary':
                return '?';
            case 'Expr_UnaryMinus':
                return '-n';
            case 'Expr_UnaryPlus':
                return '+n';
        }
        return null;
    }

    /** Test the current PhpParser_Node node to see if it is a primitive, and return the name if it is and null if it is not.
     *
     * @param Node $node The sandboxed $node to test
     *
     * @return null|string Return string name of node, or null if it is not a primitive
     */
    protected function isPrimitive(Node $node): ?string
    {
        switch ($node->getType()) {
            case 'Expr_Cast_Array':
            case 'Expr_Array':
                return 'array';
            case 'Expr_Cast_Bool': // booleans are treated as constants otherwise. . .
                return 'bool';
            case 'Expr_Cast_String':
            case 'Scalar_String':
            case 'Scalar_Encapsed':
                return 'string';
            case 'Expr_Cast_Double':
            case 'Scalar_DNumber':
                return 'float';
            case 'Expr_Cast_Int':
            case 'Scalar_LNumber':
                return 'int';
            case 'Expr_Cast_Object':
                return 'object';
        }
        return null;
    }

    protected function buildRuntimeContainerNode(): Node\Expr\StaticCall
    {
        return $this->builderFactory->staticCall('\PHPSandbox\Runtime\RuntimeContainer', 'get', $this->builderFactory->args([$this->runtimeProxy->getHash()]));
    }

    protected function buildValidatorNode(): Node\Expr\MethodCall
    {
        return $this->builderFactory->methodCall($this->buildRuntimeContainerNode(), 'validator');
    }

    protected function buildArgFunctionsNode(): Node\Expr\MethodCall
    {
        return $this->builderFactory->methodCall($this->buildRuntimeContainerNode(), 'argFunctions');
    }

    protected function buildDefinedFunctionsNode(): Node\Expr\MethodCall
    {
        return $this->builderFactory->methodCall($this->buildRuntimeContainerNode(), 'definedFunctions');
    }

    protected function buildSandboxedStringFunctionsNode(): Node\Expr\MethodCall
    {
        return $this->builderFactory->methodCall($this->buildRuntimeContainerNode(), 'sandboxedStringFunctions');
    }
}
