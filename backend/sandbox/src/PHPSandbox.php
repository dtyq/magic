<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox;

use ArrayIterator;
use Closure;
use ErrorException;
use IteratorAggregate;
use PhpParser\Error as ParserError;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\ParserFactory;
use PhpParser\PrettyPrinter\Standard;
use PHPSandbox\Cache\MemoryCacheItemPool;
use PHPSandbox\Options\AccessControl;
use PHPSandbox\Options\Definitions;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\Options\Validation;
use PHPSandbox\Options\ValidationError;
use PHPSandbox\Parser\Function\FunctionParser;
use PHPSandbox\Runtime\RuntimeContainer;
use PHPSandbox\Runtime\RuntimeProxy;
use PHPSandbox\Validation\Validator;
use PHPSandbox\Validation\Visitor\SandboxWhitelistVisitor;
use PHPSandbox\Validation\Visitor\ValidatorVisitor;
use PHPSandbox\Validation\Visitor\WhitelistVisitor;
use Psr\Cache\CacheItemPoolInterface;
use Throwable;

/**
 * PHPSandbox class for PHP Sandboxes.
 *
 * This class encapsulates the entire functionality of a PHPSandbox so that an end user
 * only has to create a PHPSandbox instance, configure its options, and run their code
 *
 * @namespace PHPSandbox
 *
 * @version 3.0
 * @method bool check_func(string $name)
 * @method bool check_var()
 * @method bool check_global()
 * @method bool check_superglobal()
 * @method bool check_const()
 * @method bool check_magic_const()
 * @method bool check_namespace()
 * @method bool check_alias()
 * @method bool check_use()
 * @method bool check_class()
 * @method bool check_interface()
 * @method bool check_trait()
 * @method bool check_keyword()
 * @method bool check_operator()
 * @method bool check_primitive()
 * @method bool check_type()
 * @method PHPSandbox clear_trusted_code()
 * @method PHPSandbox clear_prepend()
 * @method PHPSandbox clear_append()
 * @method PHPSandbox clear_code()
 * @method float get_prepared_time()
 * @method float get_execution_time()
 * @method float get_time()
 * @method null|Throwable get_last_error()
 * @method null|Throwable get_last_exception()
 * @method PHPSandbox prepare_vars()
 * @method PHPSandbox prepare_consts()
 * @method PHPSandbox prepare_namespaces()
 * @method PHPSandbox prepare_aliases()
 * @method PHPSandbox prepare_uses()
 * @method PHPSandbox auto_whitelist()
 * @method PHPSandbox auto_define()
 * @property Definitions $definitions
 * @property AccessControl $accessControl
 * @property Validation $validation
 * @property ValidationError $error
 * @property SandboxOptions $options
 */
class PHPSandbox implements IteratorAggregate
{
    /**
     * @const    string      The prefix given to the obfuscated sandbox key passed to the generated code
     */
    public const SANDBOX_PREFIX = '__PHPSandbox_';

    /**
     * @static
     * @var array A static array of sandbox inner variables
     */
    public static array $inner_variable = [
        '_sandbox_',
    ];

    protected SandboxOptions $options;

    /* TRUSTED CODE STRINGS */
    /**
     * @var array Array of sandboxed included files
     */
    protected array $includes = [];

    /**
     * @var string String of prepended code, will be automagically whitelisted for functions, variables, globals, constants, classes, interfaces and traits if is true
     */
    protected string $prependedCode = '';

    /* OUTPUT */
    /**
     * @var string String of appended code, will be automagically whitelisted for functions, variables, globals, constants, classes, interfaces and traits if is true
     */
    protected string $appendedCode = '';

    /**
     * @var float Float of the number of microseconds it took to prepare the sandbox
     */
    protected float $prepareTime = 0.0;

    /**
     * @var float Float of the number of microseconds it took to execute the sandbox
     */
    protected float $executionTime = 0.0;

    /**
     * @var int Int of the number of bytes the sandbox allocates during execution
     */
    protected int $memoryUsage = 0;

    /**
     * @var string String of preparsed code, for debugging and serialization purposes
     */
    protected string $preparsedCode = '';

    /**
     * @var array Array of parsed code broken down into AST tokens, for debugging and serialization purposes
     */
    protected array $parsedAst = [];

    /**
     * @var array array of prepared code, for debugging and serialization purposes
     */
    protected array $preparedCode = [
        'namespace' => [],
        'aliases' => [],
        'code' => '',
    ];

    /**
     * @var array Array of prepared code broken down into AST tokens, for debugging and serialization purposes
     */
    protected array $preparedAst = [];

    /**
     * @var string String of generated code, for debugging and serialization purposes
     */
    protected string $generatedCode = '';

    /**
     * @var null|array The last error thrown by the sandbox
     */
    protected ?array $lastError;

    /**
     * @var null|Throwable The last exception thrown by the sandbox
     */
    protected ?Throwable $lastException = null;

    /**
     * @var null|string The current file being executed
     */
    protected ?string $executingFile = null;

    protected Validator $validator;

    protected RuntimeProxy $runtimeProxy;

    protected CacheItemPoolInterface $cacheItemPool;

    /** PHPSandbox class constructor.
     *
     * You can pass optional arrays of predefined functions, variables, etc. to the sandbox through the constructor
     *
     * @param SandboxOptions $options Optional SandboxOptions of options to set for the sandbox
     */
    public function __construct(SandboxOptions $options)
    {
        $this->options = $options;
        $this->buildValidator();
        $this->buildSandboxRuntime();
        $this->cacheItemPool = $options->cache() ?: MemoryCacheItemPool::getInstance(0, true, 0, 200);
    }

    /** PHPSandbox __invoke magic method.
     *
     * Besides the code or closure to be executed, you can also pass additional arguments that will overwrite the default values of their respective arguments defined in the code
     *
     * @param callable|Closure|string $code The closure, callable or string of code to execute
     *
     * @return mixed The output of the executed sandboxed code
     */
    public function __invoke($code)
    {
        return call_user_func([$this, 'execute'], $code);
    }

    /** PHPSandbox __sleep magic method.
     *
     * @return array An array of property keys to be serialized
     */
    public function __sleep(): array
    {
        return array_keys(get_object_vars($this));
    }

    /** Magic method to provide API compatibility for v1.* code.
     * @param string $method The method name to call
     * @param array $arguments The method arguments to call
     * @return mixed
     */
    public function __call(string $method, array $arguments)
    {
        $renamed_method = lcfirst(str_replace('_', '', ucwords($method, '_')));
        if (method_exists($this, $renamed_method)) {
            return call_user_func_array([$this, $renamed_method], $arguments);
        }
        trigger_error('Fatal error: Call to undefined method PHPSandbox::' . $method, E_USER_ERROR);
        return null;
    }

    /** Magic method to call SandboxOptions instance members.
     * @param string $name The method arguments to call
     */
    public function __get(string $name)
    {
        switch ($name) {
            case 'definitions':
            case 'accessControl':
            case 'validation':
                return $this->options->{$name}();
            case 'options':
                return $this->getOptions();
            case 'error':
                return $this->options->validationError;
        }
    }

    /**
     * @internal
     */
    public function getValidator(): Validator
    {
        return $this->validator;
    }

    /**
     * @internal
     */
    public function getRuntimeProxy(): RuntimeProxy
    {
        return $this->runtimeProxy;
    }

    /** Get PHPSandbox generated code.
     *
     * @return string Returns a string of the generated code
     */
    public function getCode(): string
    {
        return $this->generatedCode;
    }

    /** Clear all trusted code.
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function clearTrustedCode(): self
    {
        $this->prependedCode = '';
        $this->appendedCode = '';
        return $this;
    }

    /** Prepend trusted code.
     * @param callable|string $code String or callable of trusted $code to prepend to generated code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function prepend($code): self
    {
        if (! $code) {
            return $this;
        }
        $code = $this->disassemble($code);
        if ($this->options->isAutoWhitelistTrustedCode()) {
            $this->autoWhitelist($code);
        }
        $this->prependedCode .= substr($code, 6) . "\r\n"; // remove opening php tag
        return $this;
    }

    /** PHPSandbox static factory method.
     *
     * You can pass optional arrays of predefined functions, variables, etc. to the sandbox through the constructor
     *
     * @param SandboxOptions $options Optional SandboxOptions of options to set for the sandbox
     * @return PHPSandbox The returned PHPSandbox variable
     * @throws Throwable
     */
    public static function create(SandboxOptions $options): PHPSandbox
    {
        return new self($options);
    }

    /** Append trusted code.
     * @param callable|string $code String or callable of trusted $code to append to generated code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     * @throws Throwable
     */
    public function append($code): self
    {
        if (! $code) {
            return $this;
        }
        $code = $this->disassemble($code);
        if ($this->options->isAutoWhitelistTrustedCode()) {
            $this->autoWhitelist($code, true);
        }
        $this->appendedCode .= "\r\n" . substr($code, 6) . "\r\n"; // remove opening php tag
        return $this;
    }

    /** Clear generated code.
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function clearCode(): self
    {
        $this->generatedCode = '';
        return $this;
    }

    /** Prepare passed callable for execution.
     *
     * This function validates your code and automatically whitelists it according to your specified configuration
     *
     * @param callable|string $code The callable to prepare for execution
     * @param bool $skipValidation Boolean flag to indicate whether the sandbox should skip validation. Default is false.
     *
     * @return string The generated code (this can also be accessed via $sandbox->generatedCode)
     * @throws Throwable Throws exception if error occurs in parsing, validation or whitelisting
     */
    public function prepare($code, bool $skipValidation = false): string
    {
        $this->prepareTime = microtime(true);
        // 如果不能定义常量，那么允许常量是没有意义的
        if ($this->options->isAllowConstants() && ! $this->definitions->isDefinedFunc('define') && ($this->accessControl->hasWhitelistedFuncs() || ! $this->accessControl->hasBlacklistedFuncs())) {
            $this->options->accessControl->whitelistFunc('define');    // makes no sense to allow constants if you can't define them!
        }
        // 对代码进行校验
        if ($code !== null && ! $skipValidation) {
            $this->validate($code);
        }
        // 解析PreparedCode,并且定义 namespace 和 alias
        $this->definePreparedCode();
        // 返回解析后的 代码结构 generatedCode
        $this->generatedCode = $this->prepareNamespaces()
            . $this->prepareAliases()
            . $this->prepareConsts()
            . "\r\n" . '$closure = function(){' . "\r\n"
            . $this->prepareVars()
//            $this->prepareSandboxInstance($this) .
            . $this->prependedCode
            . ($skipValidation ? $code : $this->getOriginPreparedCode())
            . $this->appendedCode
            . "\r\n" . '};'
            . "\r\n" . 'if(method_exists($closure, "bindTo")){ $closure = $closure->bindTo(null); }'
            . "\r\n" . 'return $closure();';

        //        usleep(1); // guarantee at least some time passes
        $this->prepareTime = (microtime(true) - $this->prepareTime);
        return $this->generatedCode;
    }

    public function definePreparedCode(): void
    {
        foreach ($this->getPreparedCode()['namespace'] as $name) {
            $this->definitions->defineNamespace($name);
        }

        foreach ($this->getPreparedCode()['aliases'] as $info) {
            $this->accessControl->whitelistClass($info['alias']);
            $this->accessControl->whitelistType($info['alias']);
            $this->definitions->defineAlias($info['original'], $info['alias']);
        }
    }

    /**
     * 解析preparedCode，.
     * @throws Throwable
     */
    public function getOriginPreparedCode(): string
    {
        return $this->getPreparedCode()['code'];
    }

    /** Validate passed callable for execution.
     *
     * @param callable|string $code The callable or string of code to validate
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function validate($code): self
    {
        $this->preparsedCode = $this->disassemble($code);
        $prettyPrinter = new Standard();
        $cache = $this->cacheItemPool->getItem($this->runtimeProxy->getHash() . ':' . $this->preparsedCode);

        if (! $cache->isHit()) {
            $factory = new ParserFactory();
            $parser = $factory->create(ParserFactory::PREFER_PHP7);
            // 使用PHPParser 解析代码
            try {
                $this->parsedAst = $parser->parse($this->preparsedCode);
            } catch (ParserError $error) {
                $this->error->validationError('Could not parse sandboxed code!', Error::PARSER_ERROR, null, $this->preparsedCode, $error);
            }

            // 针对解析后的ast接口进行校验，判断 define 白名单 黑名单 等要素
            if (($this->options->isAllowFunctions() && $this->options->isAutoWhitelistFunctions())
                || ($this->options->isAllowConstants() && $this->options->isAutoWhitelistConstants())
                || ($this->options->isAllowClasses() && $this->options->isAutoWhitelistClasses())
                || ($this->options->isAllowInterfaces() && $this->options->isAutoWhitelistInterfaces())
                || ($this->options->isAllowTraits() && $this->options->isAutoWhitelistTraits())
                || ($this->options->isAllowGlobals() && $this->options->isAutoWhitelistGlobals())) {
                $traverser = new NodeTraverser();
                $whitelister = new SandboxWhitelistVisitor($this);
                $traverser->addVisitor($whitelister);
                $traverser->traverse($this->parsedAst);
            }

            $traverser = new NodeTraverser();

            $validator = new ValidatorVisitor($this);

            $traverser->addVisitor($validator);

            $this->preparedAst = $traverser->traverse($this->parsedAst);

            $cache->set([
                'ast' => $this->preparedAst,
                'code' => $prettyPrinter->prettyPrint($this->preparedAst),
            ]);
            $this->cacheItemPool->save($cache);
        } else {
            $value = $cache->get();
            $this->preparedAst = $value['ast'];
            $this->preparedCode['code'] = $value['code'];
        }

        $this->preparedCode['namespace'] = $this->definitions->getDefinedNamespace();
        $this->preparedCode['aliases'] = $this->definitions->getDefinedAlias();
        $this->preparedCode['code'] = $prettyPrinter->prettyPrint($this->preparedAst);

        return $this;
    }

    /** Prepare and execute callable and return output.
     *
     * This function validates your code and automatically whitelists it according to your specified configuration, then executes it.
     *
     * @param callable|SandboxOptions|string $callable Callable or string of PHP code to prepare and execute within the sandbox
     * @param bool $skipValidation Boolean flag to indicate whether the sandbox should skip validation of the pass callable. Default is false.
     * @param null|string $executingFile The file path of the code to execute
     * @param SandboxOptions $resetOptions The rereplace options to execute
     *
     * @return mixed The output from the executed sandboxed code
     * @throws Throwable Throws exception if error occurs in parsing, validation or whitelisting or if generated closure is invalid
     */
    public function execute($callable = null, bool $skipValidation = false, ?string $executingFile = null, ?SandboxOptions $resetOptions = null)
    {
        if ($callable instanceof SandboxOptions) {
            $snapshotBox = clone $this;
            return $snapshotBox->setOptions($callable)->execute(null, $skipValidation, $executingFile);
        }
        if ($resetOptions) {
            $snapshotBox = clone $this;
            return $snapshotBox->setOptions($resetOptions)->execute($callable, $skipValidation, $executingFile);
        }
        // 要执行的代码的文件路径
        if ($executingFile) {
            $this->setExecutingFile($executingFile);
        }
        $this->executionTime = microtime(true);
        $this->memoryUsage = memory_get_peak_usage();
        // 生成generatedCode
        $this->prepare($callable, $skipValidation);
        $saved_error_level = null;
        if ($this->options->getErrorLevel() !== null) {
            $saved_error_level = error_reporting();
            error_reporting(intval($this->options->getErrorLevel()));
        }
        if (is_callable($this->options->getErrorHandler()) || $this->options->isConvertErrors()) {
            set_error_handler([$this, 'error'], $this->options->getErrorHandlerTypes());
        }
        if ($this->options->getTimeLimit()) {
            set_time_limit($this->options->getTimeLimit());
        }
        $exception = null;
        $result = null;
        try {
            RuntimeContainer::set($this->runtimeProxy);
            if ($this->options->isCaptureOutput()) {
                ob_start();
                eval($this->generatedCode);
                $result = ob_get_clean();
            } else {
                $result = eval($this->generatedCode);
            }
        } catch (Throwable $exception) {
            // swallow any exceptions
        } finally {
            RuntimeContainer::destroy($this->runtimeProxy);
        }
        if (is_callable($this->options->getErrorHandler()) || $this->options->isConvertErrors()) {
            restore_error_handler();
        }
        //        usleep(1); // guarantee at least some time passes
        $this->memoryUsage = (memory_get_peak_usage() - $this->memoryUsage);
        $this->executionTime = (microtime(true) - $this->executionTime);
        if ($this->options->getErrorLevel() !== null && $this->options->isRestoreErrorLevel()) {
            error_reporting($saved_error_level);
        }
        return $exception instanceof Throwable ? $this->exception($exception) : $result;
    }

    /** Set PHPSandbox generated code.
     *
     * @param string $generatedCode Sets a string of the generated code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function setCode(string $generatedCode = ''): self
    {
        $this->generatedCode = $generatedCode;
        return $this;
    }

    /** Get PHPSandbox prepended code.
     * @return string Returns a string of the prepended code
     */
    public function getPrependedCode(): string
    {
        return $this->prependedCode;
    }

    /** Set PHPSandbox prepended code.
     *
     * @param string $prependedCode Sets a string of the prepended code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function setPrependedCode(string $prependedCode = ''): self
    {
        $this->prependedCode = $prependedCode;
        return $this;
    }

    /** Get PHPSandbox appended code.
     * @return string Returns a string of the appended code
     */
    public function getAppendedCode(): string
    {
        return $this->appendedCode;
    }

    /** Set PHPSandbox appended code.
     *
     * @param string $appendedCode Sets a string of the appended code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function setAppendedCode(string $appendedCode = ''): self
    {
        $this->appendedCode = $appendedCode;
        return $this;
    }

    /** Get PHPSandbox preparsed code.
     * @return string Returns a string of the preparsed code
     */
    public function getPreparsedCode(): string
    {
        return $this->preparsedCode;
    }

    /** Set PHPSandbox preparsed code.
     *
     * @param string $preparsedCode Sets a string of the preparsed code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function setPreparsedCode(string $preparsedCode = ''): self
    {
        $this->preparsedCode = $preparsedCode;
        return $this;
    }

    /** Get PHPSandbox parsed AST array.
     * @return array Returns an array of the parsed AST code
     */
    public function getParsedAST(): array
    {
        return $this->parsedAst;
    }

    /** Set PHPSandbox parsed AST array.
     *
     * @param array $parsedAst Sets an array of the parsed AST code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function setParsedAST(array $parsedAst = []): self
    {
        $this->parsedAst = $parsedAst;
        return $this;
    }

    /** Get PHPSandbox prepared code.
     * @return string Returns a string of the prepared code
     */
    public function getPreparedCode(): array
    {
        return $this->preparedCode;
    }

    /** Set PHPSandbox prepared code. preparedCode 是一个json字符串
     * 里面包含 namespace aliases prepared_code.
     *
     * @param array $preparedCode Sets a Array of the prepared code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function setPreparedCode(array $preparedCode): self
    {
        $this->preparedCode['namespace'] = $preparedCode['namespace'] ?? [];
        $this->preparedCode['aliases'] = $preparedCode['aliases'] ?? [];
        $this->preparedCode['code'] = $preparedCode['code'] ?? '';
        return $this;
    }

    /** Get PHPSandbox prepared AST array.
     * @return array Returns an array of the prepared AST code
     */
    public function getPreparedAST(): array
    {
        return $this->preparedAst;
    }

    /** Set PHPSandbox prepared AST array.
     *
     * @param array $preparedAst Sets an array of the prepared AST code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function setPreparedAST(array $preparedAst = []): self
    {
        $this->preparedAst = $preparedAst;
        return $this;
    }

    /** Get PHPSandbox generated code.
     * @return string Returns a string of the generated code
     */
    public function getGeneratedCode(): string
    {
        return $this->generatedCode;
    }

    /** Set PHPSandbox generated code.
     *
     * @param string $generatedCode Sets a string of the generated code
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function setGeneratedCode(string $generatedCode = ''): self
    {
        $this->generatedCode = $generatedCode;
        return $this;
    }

    /** Return get_included_files() and sandboxed included files.
     *
     * @return array Returns array of get_included_files() and sandboxed included files
     */
    public function _get_included_files(): array
    {
        return array_merge(get_included_files(), $this->includes);
    }

    /** Sandbox included file.
     *
     * @internal
     * @param mixed $file Included file to sandbox
     *
     * @return mixed Returns value passed from included file
     */
    public function _include($file)
    {
        if ($file instanceof SandboxedString) {
            $file = strval($file);
        }
        $code = @file_get_contents($file, true);
        if ($code === false) {
            trigger_error("include('" . $file . "') [function.include]: failed to open stream. No such file or directory", E_USER_WARNING);
            return false;
        }
        if (! in_array($file, $this->_get_included_files())) {
            $this->includes[] = $file;
        }
        return $this->execute($code, false, $file);
    }

    /** Sandbox included once file.
     *
     * @internal
     * @param mixed $file Included once file to sandbox
     *
     * @return mixed Returns value passed from included once file
     */
    public function _include_once($file)
    {
        if ($file instanceof SandboxedString) {
            $file = strval($file);
        }
        if (! in_array($file, $this->_get_included_files())) {
            $code = @file_get_contents($file, true);
            if ($code === false) {
                trigger_error("include_once('" . $file . "') [function.include-once]: failed to open stream. No such file or directory", E_USER_WARNING);
                return false;
            }
            $this->includes[] = $file;
            return $this->execute($code, false, $file);
        }
        return null;
    }

    /** Sandbox required file.
     *
     * @internal
     * @param mixed $file Required file to sandbox
     *
     * @return mixed Returns value passed from required file
     */
    public function _require($file)
    {
        if ($file instanceof SandboxedString) {
            $file = strval($file);
        }
        $code = @file_get_contents($file, true);
        if ($code === false) {
            trigger_error("require('" . $file . "') [function.require]: failed to open stream. No such file or directory", E_USER_WARNING);
            trigger_error("Failed opening required '" . $file . "' (include_path='" . get_include_path() . "')", E_USER_ERROR);
            return false;
        }
        if (! in_array($file, $this->_get_included_files())) {
            $this->includes[] = $file;
        }
        return $this->execute($code, false, $file);
    }

    /** Sandbox required once file.
     *
     * @internal
     * @param mixed $file Required once file to sandbox
     *
     * @return mixed Returns value passed from required once file
     */
    public function _require_once($file)
    {
        if ($file instanceof SandboxedString) {
            $file = strval($file);
        }
        if (! in_array($file, $this->_get_included_files())) {
            $code = @file_get_contents($file, true);
            if ($code === false) {
                trigger_error("require_once('" . $file . "') [function.require-once]: failed to open stream. No such file or directory", E_USER_WARNING);
                trigger_error("Failed opening required '" . $file . "' (include_path='" . get_include_path() . "')", E_USER_ERROR);
                return false;
            }
            $this->includes[] = $file;
            return $this->execute($code, false, $file);
        }
        return null;
    }

    /** Clear all trusted and sandboxed code.
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function clear(): self
    {
        $this->prependedCode = '';
        $this->generatedCode = '';
        $this->appendedCode = '';
        $this->runtimeProxy->clear();

        return $this;
    }

    /** Clear all prepended trusted code.
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function clearPrepended(): self
    {
        $this->prependedCode = '';
        return $this;
    }

    /** Clear all prepended trusted code.
     *
     * @alias   $this->clearPrepended()
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function clearPrependedCode(): self
    {
        $this->prependedCode = '';
        return $this;
    }

    /** Clear all appended trusted code.
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function clearAppend(): self
    {
        $this->appendedCode = '';
        return $this;
    }

    /** Clear all appended trusted code.
     *
     * @alias   $this->clearAppend()
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function clearAppendedCode(): self
    {
        $this->appendedCode = '';
        return $this;
    }

    /** Return the amount of time the sandbox spent preparing the sandboxed code.
     *
     * You can pass the number of digits you wish to round the return value
     *
     * @param int $round The number of digits to round the return value
     *
     * @return float The amount of time in microseconds it took to prepare the sandboxed code
     */
    public function getPreparedTime(int $round = 0): float
    {
        return $round > 0 ? round($this->prepareTime, $round) : $this->prepareTime;
    }

    /** Return the amount of time the sandbox spent executing the sandboxed code.
     *
     * You can pass the number of digits you wish to round the return value
     *
     * @param int $round The number of digits to round the return value
     *
     * @return float The amount of time in microseconds it took to execute the sandboxed code
     */
    public function getExecutionTime(int $round = 0): float
    {
        return $round > 0 ? round($this->executionTime, $round) : $this->executionTime;
    }

    /** Return the current file being executed in the sandbox.
     *
     * @return null|string The current file being executed
     */
    public function getExecutingFile(): ?string
    {
        return $this->executingFile;
    }

    /** Set the currently executing filepath.
     *
     * @param null|string $executingFile The file currently being executed
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    public function setExecutingFile(?string $executingFile): self
    {
        $this->executingFile = realpath($executingFile);
        return $this;
    }

    /** Return the amount of time the sandbox spent preparing and executing the sandboxed code.
     *
     * You can pass the number of digits you wish to round the return value
     *
     * @param int $round The number of digits to round the return value
     *
     * @return float The amount of time in microseconds it took to prepare and execute the sandboxed code
     */
    public function getTime(int $round = 0): float
    {
        return $round > 0 ? round($this->prepareTime + $this->executionTime, $round) : ($this->prepareTime + $this->executionTime);
    }

    /** Return the amount of bytes the sandbox allocated while preparing and executing the sandboxed code.
     *
     * You can pass the number of digits you wish to round the return value
     *
     * @param int $round The number of digits to round the return value
     *
     * @return float The amount of bytes in memory it took to prepare and execute the sandboxed code
     */
    public function getMemoryUsage(int $round = 0): float
    {
        return $round > 0 ? round($this->memoryUsage, $round) : $this->memoryUsage;
    }

    /** Gets the last sandbox error.
     */
    public function getLastError(): ?array
    {
        return $this->lastError;
    }

    /** Invoke sandbox error handler.
     *
     * @param int $errno Error number
     * @param string $errstr Error message
     * @param string $errfile Error file
     * @param int $errline Error line number
     * @param array $errcontext Error context array
     *
     * @return mixed
     * @throws Throwable
     */
    public function error(int $errno, string $errstr, string $errfile, int $errline, array $errcontext = [])
    {
        $this->lastError = error_get_last();
        if ($this->options->isConvertErrors()) {
            return $this->exception(new ErrorException($errstr, 0, $errno, $errfile, $errline));
        }
        return is_callable($this->options->getErrorHandler())
            ? call_user_func_array($this->options->getErrorHandler(), [$errno, $errstr, $errfile, $errline, $errcontext, $this])
            : null;
    }

    /** Invoke sandbox exception handler.
     *
     * @param Throwable $exception Exception to be handled
     *
     * @return mixed
     * @throws Throwable
     */
    public function exception(Throwable $exception)
    {
        $this->lastException = $exception;
        if (is_callable($this->options->getExceptionHandler())) {
            return call_user_func_array($this->options->getExceptionHandler(), [$exception, $this]);
        }
        throw $exception;
    }

    /** Gets the last exception thrown by the sandbox.
     */
    public function getLastException(): ?Throwable
    {
        return $this->lastException;
    }

    /** Get an iterator of all the public PHPSandbox properties.
     */
    public function getIterator(): ArrayIterator
    {
        return new ArrayIterator(get_object_vars($this));
    }

    public function getOptions(): SandboxOptions
    {
        return $this->options;
    }

    public function setOptions(SandboxOptions $options): self
    {
        $this->options = $options;
        $this->buildValidator();
        $this->buildSandboxRuntime();

        return $this;
    }

    protected function buildValidator(): void
    {
        $this->validator = new Validator($this->options);
    }

    protected function buildSandboxRuntime(): void
    {
        $this->runtimeProxy = new RuntimeProxy($this->options, $this->validator);
    }

    /** Disassemble callable to string.
     *
     * @param mixed $closure The callable to disassemble
     *
     * @return string Return the disassembled code string
     * @throws Throwable Throw exception if callable is passed and FunctionParser library is missing
     */
    protected function disassemble($closure): string
    {
        if (is_string($closure) && ! is_callable($closure)) {
            return substr($closure, 0, 2) == '<?' ? $closure : '<?php ' . $closure;
        }
        $disassembled_closure = FunctionParser::fromCallable($closure);
        if ($this->options->isAutoDefineVars()) {
            $this->autoDefine($disassembled_closure);
        }
        return '<?php' . $disassembled_closure->getBody();
    }

    /** Automatically define variables passed to disassembled closure.
     *
     * @return PHPSandbox Returns the PHPSandbox instance for fluent querying
     */
    protected function autoDefine(FunctionParser $disassembled_closure): self
    {
        $parameters = $disassembled_closure->getReflection()->getParameters();
        foreach ($parameters as $param) {
            /*
             * @var ReflectionParameter $param
             */
            $this->definitions->defineVar($param->getName(), $param->isDefaultValueAvailable() ? $param->getDefaultValue() : null);
        }
        return $this;
    }

    /** Automatically whitelisted trusted code.
     *
     * @param string $code String of trusted $code to automatically whitelist
     * @param bool $appended Flag if this code ir prended or appended (true = appended)
     *
     * @return mixed Return result of error handler if $code could not be parsed
     * @throws Throwable Throw exception if code cannot be parsed for whitelisting
     */
    protected function autoWhitelist(string $code, bool $appended = false)
    {
        $factory = new ParserFactory();
        $parser = $factory->create(ParserFactory::PREFER_PHP7);
        try {
            $statements = $parser->parse($code);
        } catch (ParserError $error) {
            return $this->error->validationError('Error parsing ' . ($appended ? 'appended' : 'prepended') . ' sandboxed code for auto-whitelisting!', Error::PARSER_ERROR, null, $code, $error);
        }
        $traverser = new NodeTraverser();
        $whitelister = new WhitelistVisitor($this);
        $traverser->addVisitor($whitelister);
        $traverser->traverse($statements);
        return true;
    }

    /** Prepare defined namespaces for execution.
     *
     * @return string Prepared string of namespaces output
     * @throws Throwable Throws exception if validation error occurs
     */
    protected function prepareNamespaces(): string
    {
        $output = [];
        foreach ($this->definitions->getDefinedNamespace() as $name) {
            if (is_string($name) && $name) {
                $output[] = 'namespace ' . $name . ';';
            } else {
                $this->error->validationError("Sandboxed code attempted to create invalid namespace: {$name}", Error::DEFINE_NAMESPACE_ERROR, null, $name);
            }
        }
        return count($output) ? implode("\r\n", $output) . "\r\n" : '';
    }

    /** Prepare defined uses (or aliases) for execution.
     * @alias   prepareAliases();
     *
     * @return string Prepared string of aliases (or uses) output
     * @throws Throwable Throws exception if validation error occurs
     */
    protected function prepareUses(): string
    {
        return $this->prepareAliases();
    }

    /** Prepare defined aliases for execution.
     *
     * @return string Prepared string of aliases (or uses) output
     * @throws Throwable Throws exception if validation error occurs
     */
    protected function prepareAliases(): string
    {
        $output = [];
        foreach ($this->definitions->getDefinedAlias() as $alias) {
            if (is_array($alias) && isset($alias['original']) && is_string($alias['original']) && $alias['original']) {
                $output[] = 'use ' . $alias['original'] . ((isset($alias['alias']) && (is_string($alias['alias']) || $alias['alias'] instanceof Node\Identifier) && $alias['alias']) ? ' as ' . $alias['alias'] : '') . ';';
            } else {
                $this->error->validationError('Sandboxed code attempted to use invalid namespace alias: ' . $alias['original'], Error::DEFINE_ALIAS_ERROR, null, $alias['original']);
            }
        }
        return count($output) ? implode("\r\n", $output) . "\r\n" : '';
    }

    /** Prepare defined constants for execution.
     *
     * @return string Prepared string of constants output
     * @throws Throwable Throws exception if validation error occurs
     */
    protected function prepareConsts(): string
    {
        $output = [];
        foreach ($this->definitions->getDefinedConsts() as $name => $value) {
            if (is_scalar($value) || is_null($value)) {
                if (is_bool($value)) {
                    $output[] = '\define(' . "'" . $name . "', " . ($value ? 'true' : 'false') . ');';
                } elseif (is_int($value)) {
                    $output[] = '\define(' . "'" . $name . "', " . ($value ? $value : '0') . ');';
                } elseif (is_float($value)) {
                    $output[] = '\define(' . "'" . $name . "', " . ($value ? $value : '0.0') . ');';
                } elseif (is_string($value)) {
                    $output[] = '\define(' . "'" . $name . "', '" . addcslashes($value, "'\\") . "');";
                } else {
                    $output[] = '\define(' . "'" . $name . "', null);";
                }
            } else {
                $this->error->validationError("Sandboxed code attempted to define non-scalar constant value: {$name}", Error::DEFINE_CONST_ERROR, null, $name);
            }
        }
        return count($output) ? implode("\r\n", $output) . "\r\n" : '';
    }

    /** Prepare defined variables for execution.
     *
     * @return string Prepared string of variable output
     * @throws Throwable Throws exception if validation error occurs
     */
    protected function prepareVars(): string
    {
        $output = [];
        foreach ($this->definitions->getDefinedVars() as $name => $value) {
            if (is_int($name)) {  // can't define numeric variable names
                $this->error->validationError('Cannot define variable name that begins with an integer!', Error::DEFINE_VAR_ERROR, null, $name);
            }
            if (is_scalar($value) || is_null($value)) {
                if (is_bool($value)) {
                    $output[] = '$' . $name . ' = ' . ($value ? 'true' : 'false');
                } elseif (is_int($value)) {
                    $output[] = '$' . $name . ' = ' . ($value ? $value : '0');
                } elseif (is_float($value)) {
                    $output[] = '$' . $name . ' = ' . ($value ? $value : '0.0');
                } elseif (is_string($value)) {
                    $output[] = '$' . $name . " = '" . addcslashes($value, "'\\") . "'";
                } else {
                    $output[] = '$' . $name . ' = null';
                }
            } else {
                $output[] = '$' . $name . " = unserialize('" . addcslashes(serialize($value), "'\\") . "')";
            }
        }
        return count($output) ? "\r\n" . implode(";\r\n", $output) . ";\r\n" : '';
    }
}
