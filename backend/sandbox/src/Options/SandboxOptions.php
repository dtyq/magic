<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Options;

use PHPSandbox\PHPSandbox;
use Psr\Cache\CacheItemPoolInterface;

/**
 * @property Definitions $definitions
 * @property AccessControl $accessControlOptions
 * @property Validation $validation
 * @property ValidationError $validationError
 */
class SandboxOptions
{
    /**
     * @var null|Definitions Definition Configuration
     */
    protected ?Definitions $definitions = null;

    /**
     * @var null|AccessControl AccessControlOptions Configuration
     */
    protected ?AccessControl $accessControl = null;

    /**
     * @var null|Validation Validation Configuration
     */
    protected ?Validation $validation = null;

    /**
     * @var ValidationError ValidationError Configuration
     */
    protected ValidationError $validationError;

    protected ?CacheItemPoolInterface $cache;

    /**
     * @var string The randomly generated name of the PHPSandbox variable passed to the generated closure
     */
    protected string $name = '';

    /**
     * @var bool Flag to indicate whether the sandbox should validate functions
     * @default true
     */
    protected bool $validateFunctions = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate variables
     * @default true
     */
    protected bool $validateVariables = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate globals
     * @default true
     */
    protected bool $validateGlobals = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate superglobals
     * @default true
     */
    protected bool $validateSuperglobals = true;

    /* CONFIGURATION OPTION FLAGS */
    /**
     * @var bool Flag to indicate whether the sandbox should validate constants
     * @default true
     */
    protected bool $validateConstants = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate magic constants
     * @default true
     */
    protected bool $validateMagicConstants = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate namespaces
     * @default true
     */
    protected bool $validateNamespaces = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate aliases (aka use)
     * @default true
     */
    protected bool $validateAliases = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate classes
     * @default true
     */
    protected bool $validateClasses = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate interfaces
     * @default true
     */
    protected bool $validateInterfaces = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate traits
     * @default true
     */
    protected bool $validateTraits = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate keywords
     * @default true
     */
    protected bool $validateKeywords = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate operators
     * @default true
     */
    protected bool $validateOperators = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate primitives
     * @default true
     */
    protected bool $validatePrimitives = true;

    /**
     * @var bool Flag to indicate whether the sandbox should validate types
     * @default true
     */
    protected bool $validateTypes = true;

    /**
     * @var null|int the error_reporting level to set the PHPSandbox scope to when executing the generated closure, if set to null it will use parent scope error level
     * @default true
     */
    protected ?int $errorLevel = null;

    /**
     * @var int Integer value of maximum number of seconds the sandbox should be allowed to execute
     * @default 0
     */
    protected int $timeLimit = 0;

    /**
     * @var bool Flag to indicate whether the sandbox should allow included files
     * @default false
     */
    protected bool $allowIncludes = false;

    /**
     * @var bool Flag to indicate whether the sandbox should automatically sandbox included files
     * @default true
     */
    protected bool $sandboxIncludes = true;

    /**
     * @var bool Flag to indicate whether the sandbox should return error_reporting to its previous level after execution
     * @default true
     */
    protected bool $restoreErrorLevel = true;

    /**
     * @var bool Flag to indicate whether the sandbox should convert errors to exceptions
     * @default false
     */
    protected bool $convertErrors = false;

    /**
     * @var bool Flag whether to return output via an output buffer
     * @default false
     */
    protected bool $captureOutput = false;

    /**
     * @var bool Should PHPSandbox automagically whitelist prepended and appended code?
     * @default true
     */
    protected bool $autoWhitelistTrustedCode = true;

    /**
     * @var bool Should PHPSandbox automagically whitelist functions created in sandboxed code if is true?
     * @default true
     */
    protected bool $autoWhitelistFunctions = true;

    /**
     * @var bool Should PHPSandbox automagically whitelist constants created in sandboxed code if is true?
     * @default true
     */
    protected bool $autoWhitelistConstants = true;

    /**
     * @var bool Should PHPSandbox automagically whitelist global variables created in sandboxed code if is true? (Used to whitelist them in the variables list)
     * @default true
     */
    protected bool $autoWhitelistGlobals = true;

    /**
     * @var bool Should PHPSandbox automagically whitelist classes created in sandboxed code if is true?
     * @default true
     */
    protected bool $autoWhitelistClasses = true;

    /**
     * @var bool Should PHPSandbox automagically whitelist interfaces created in sandboxed code if is true?
     * @default true
     */
    protected bool $autoWhitelistInterfaces = true;

    /**
     * @var bool Should PHPSandbox automagically whitelist traits created in sandboxed code if is true?
     * @default true
     */
    protected bool $autoWhitelistTraits = true;

    /**
     * @var bool Should PHPSandbox automagically define variables passed to prepended, appended and prepared code closures?
     * @default true
     */
    protected bool $autoDefineVars = true;

    /**
     * @var bool Should PHPSandbox overwrite get_defined_functions, get_defined_vars, get_defined_constants, get_declared_classes, get_declared_interfaces and get_declared_traits?
     * @default true
     */
    protected bool $overwriteDefinedFuncs = true;

    /**
     * @var bool Should PHPSandbox overwrite func_get_args, func_get_arg and func_num_args?
     * @default true
     */
    protected bool $overwriteFuncGetArgs = true;

    /**
     * @var bool Should PHPSandbox overwrite functions to help hide SandboxedStrings?
     * @default true
     */
    protected bool $overwriteSandboxedStringFuncs = true;

    /**
     * @var bool should PHPSandbox overwrite,,,,,,, and superglobals? If so, unless alternate superglobal values have been defined they will return as empty arrays
     * @default true
     */
    protected bool $overwriteSuperglobals = true;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to declare functions?
     * @default false
     */
    protected bool $allowFunctions = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to declare closures?
     * @default false
     */
    protected bool $allowClosures = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to create variables?
     * @default true
     */
    protected bool $allowVariables = true;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to create static variables?
     * @default true
     */
    protected bool $allowStaticVariables = true;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to create objects of allow classes (e.g. new keyword)?
     * @default true
     */
    protected bool $allowObjects = true;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to define constants?
     * @default false
     */
    protected bool $allowConstants = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to use global keyword to access variables in the global scope?
     * @default false
     */
    protected bool $allowGlobals = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to declare namespaces (utilizing the defineNamespace function?)
     * @default false
     */
    protected bool $allowNamespaces = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to use namespaces and declare namespace aliases (utilizing the defineAlias function?)
     * @default false
     */
    protected bool $allowAliases = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to declare classes?
     * @default false
     */
    protected bool $allowClasses = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to declare interfaces?
     * @default false
     */
    protected bool $allowInterfaces = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to declare traits?
     * @default false
     */
    protected bool $allowTraits = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to create generators?
     * @default true
     */
    protected bool $allowGenerators = true;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to escape to HTML?
     * @default false
     */
    protected bool $allowEscaping = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to cast types? (This will still be subject to allowed classes)
     * @default false
     */
    protected bool $allowCasting = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to suppress errors (e.g. the @ operator?)
     * @default false
     */
    protected bool $allowErrorSuppressing = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to assign references?
     * @default true
     */
    protected bool $allowReferences = true;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to use backtick execution? (e.g. = \`ping google.com\`; This will also be disabled if shell_exec is not whitelisted or if it is blacklisted, and will be converted to a defined shell_exec function call if one is defined)
     * @default false
     */
    protected bool $allowBackticks = false;

    /**
     * @var bool Should PHPSandbox allow sandboxed code to halt the PHP compiler?
     * @default false
     */
    protected bool $allowHalting = false;

    /**
     * @var bool Should PHPSandbox sandbox all string values?
     * @default true
     */
    protected bool $sandboxStrings = true;

    /**
     * @var null|callable Callable that handles any errors when set
     */
    protected $errorHandler;

    /**
     * @var int Integer value of the error types to handle (default is E_ALL)
     */
    protected int $errorHandlerTypes = E_ALL;

    /**
     * @var null|callable Callable that handles any thrown exceptions when set
     */
    protected $exceptionHandler;

    public function __construct(
        ?Definitions $definitions = null,
        ?AccessControl $accessControlOptions = null,
        ?Validation $validation = null,
        ?ValidationError $validationError = null,
        ?CacheItemPoolInterface $cache = null
    ) {
        $this->definitions = $definitions ?? new Definitions();
        $this->accessControl = $accessControlOptions ?? new AccessControl();
        $this->validation = $validation ?? new Validation();
        $this->validationError = $validationError ?? new ValidationError();
        $this->cache = $cache;
    }

    public function __get(string $name)
    {
        $method = 'get' . ucwords($name);
        if (method_exists($this, $method)) {
            return call_user_func_array([$this, $method], []);
        }
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function isValidateFunctions(): bool
    {
        return $this->validateFunctions;
    }

    public function setValidateFunctions(bool $validateFunctions): self
    {
        $this->validateFunctions = $validateFunctions;
        return $this;
    }

    public function isValidateVariables(): bool
    {
        return $this->validateVariables;
    }

    public function setValidateVariables(bool $validateVariables): self
    {
        $this->validateVariables = $validateVariables;
        return $this;
    }

    public function isValidateGlobals(): bool
    {
        return $this->validateGlobals;
    }

    public function setValidateGlobals(bool $validateGlobals): self
    {
        $this->validateGlobals = $validateGlobals;
        return $this;
    }

    public function isValidateSuperglobals(): bool
    {
        return $this->validateSuperglobals;
    }

    public function setValidateSuperglobals(bool $validateSuperglobals): self
    {
        $this->validateSuperglobals = $validateSuperglobals;
        return $this;
    }

    public function isValidateConstants(): bool
    {
        return $this->validateConstants;
    }

    public function setValidateConstants(bool $validateConstants): self
    {
        $this->validateConstants = $validateConstants;
        return $this;
    }

    public function isValidateMagicConstants(): bool
    {
        return $this->validateMagicConstants;
    }

    public function setValidateMagicConstants(bool $validateMagicConstants): self
    {
        $this->validateMagicConstants = $validateMagicConstants;
        return $this;
    }

    public function isValidateNamespaces(): bool
    {
        return $this->validateNamespaces;
    }

    public function setValidateNamespaces(bool $validateNamespaces): self
    {
        $this->validateNamespaces = $validateNamespaces;
        return $this;
    }

    public function isValidateAliases(): bool
    {
        return $this->validateAliases;
    }

    public function setValidateAliases(bool $validateAliases): self
    {
        $this->validateAliases = $validateAliases;
        return $this;
    }

    public function isValidateClasses(): bool
    {
        return $this->validateClasses;
    }

    public function setValidateClasses(bool $validateClasses): self
    {
        $this->validateClasses = $validateClasses;
        return $this;
    }

    public function isValidateInterfaces(): bool
    {
        return $this->validateInterfaces;
    }

    public function setValidateInterfaces(bool $validateInterfaces): self
    {
        $this->validateInterfaces = $validateInterfaces;
        return $this;
    }

    public function isValidateTraits(): bool
    {
        return $this->validateTraits;
    }

    public function setValidateTraits(bool $validateTraits): self
    {
        $this->validateTraits = $validateTraits;
        return $this;
    }

    public function isValidateKeywords(): bool
    {
        return $this->validateKeywords;
    }

    public function setValidateKeywords(bool $validateKeywords): self
    {
        $this->validateKeywords = $validateKeywords;
        return $this;
    }

    public function isValidateOperators(): bool
    {
        return $this->validateOperators;
    }

    public function setValidateOperators(bool $validateOperators): self
    {
        $this->validateOperators = $validateOperators;
        return $this;
    }

    public function isValidatePrimitives(): bool
    {
        return $this->validatePrimitives;
    }

    public function setValidatePrimitives(bool $validatePrimitives): self
    {
        $this->validatePrimitives = $validatePrimitives;
        return $this;
    }

    public function isValidateTypes(): bool
    {
        return $this->validateTypes;
    }

    public function setValidateTypes(bool $validateTypes): self
    {
        $this->validateTypes = $validateTypes;
        return $this;
    }

    public function getErrorLevel(): ?int
    {
        return $this->errorLevel;
    }

    public function setErrorLevel(?int $errorLevel): self
    {
        $this->errorLevel = $errorLevel;
        return $this;
    }

    public function getTimeLimit(): int
    {
        return $this->timeLimit;
    }

    public function setTimeLimit(int $timeLimit): self
    {
        $this->timeLimit = $timeLimit;
        return $this;
    }

    public function isAllowIncludes(): bool
    {
        return $this->allowIncludes;
    }

    public function setAllowIncludes(bool $allowIncludes): self
    {
        $this->allowIncludes = $allowIncludes;
        return $this;
    }

    public function isSandboxIncludes(): bool
    {
        return $this->sandboxIncludes;
    }

    public function setSandboxIncludes(bool $sandboxIncludes): self
    {
        $this->sandboxIncludes = $sandboxIncludes;
        return $this;
    }

    public function isRestoreErrorLevel(): bool
    {
        return $this->restoreErrorLevel;
    }

    public function setRestoreErrorLevel(bool $restoreErrorLevel): self
    {
        $this->restoreErrorLevel = $restoreErrorLevel;
        return $this;
    }

    public function isConvertErrors(): bool
    {
        return $this->convertErrors;
    }

    public function setConvertErrors(bool $convertErrors): self
    {
        $this->convertErrors = $convertErrors;
        return $this;
    }

    public function isCaptureOutput(): bool
    {
        return $this->captureOutput;
    }

    public function setCaptureOutput(bool $captureOutput): self
    {
        $this->captureOutput = $captureOutput;
        return $this;
    }

    public function isAutoWhitelistTrustedCode(): bool
    {
        return $this->autoWhitelistTrustedCode;
    }

    public function setAutoWhitelistTrustedCode(bool $autoWhitelistTrustedCode): self
    {
        $this->autoWhitelistTrustedCode = $autoWhitelistTrustedCode;
        return $this;
    }

    public function isAutoWhitelistFunctions(): bool
    {
        return $this->autoWhitelistFunctions;
    }

    public function setAutoWhitelistFunctions(bool $autoWhitelistFunctions): self
    {
        $this->autoWhitelistFunctions = $autoWhitelistFunctions;
        return $this;
    }

    public function isAutoWhitelistConstants(): bool
    {
        return $this->autoWhitelistConstants;
    }

    public function setAutoWhitelistConstants(bool $autoWhitelistConstants): self
    {
        $this->autoWhitelistConstants = $autoWhitelistConstants;
        return $this;
    }

    public function isAutoWhitelistGlobals(): bool
    {
        return $this->autoWhitelistGlobals;
    }

    public function setAutoWhitelistGlobals(bool $autoWhitelistGlobals): self
    {
        $this->autoWhitelistGlobals = $autoWhitelistGlobals;
        return $this;
    }

    public function isAutoWhitelistClasses(): bool
    {
        return $this->autoWhitelistClasses;
    }

    public function setAutoWhitelistClasses(bool $autoWhitelistClasses): self
    {
        $this->autoWhitelistClasses = $autoWhitelistClasses;
        return $this;
    }

    public function isAutoWhitelistInterfaces(): bool
    {
        return $this->autoWhitelistInterfaces;
    }

    public function setAutoWhitelistInterfaces(bool $autoWhitelistInterfaces): self
    {
        $this->autoWhitelistInterfaces = $autoWhitelistInterfaces;
        return $this;
    }

    public function isAutoWhitelistTraits(): bool
    {
        return $this->autoWhitelistTraits;
    }

    public function setAutoWhitelistTraits(bool $autoWhitelistTraits): self
    {
        $this->autoWhitelistTraits = $autoWhitelistTraits;
        return $this;
    }

    public function isAutoDefineVars(): bool
    {
        return $this->autoDefineVars;
    }

    public function setAutoDefineVars(bool $autoDefineVars): self
    {
        $this->autoDefineVars = $autoDefineVars;
        return $this;
    }

    public function isOverwriteDefinedFuncs(): bool
    {
        return $this->overwriteDefinedFuncs;
    }

    public function setOverwriteDefinedFuncs(bool $overwriteDefinedFuncs): self
    {
        $this->overwriteDefinedFuncs = $overwriteDefinedFuncs;
        return $this;
    }

    public function isOverwriteFuncGetArgs(): bool
    {
        return $this->overwriteFuncGetArgs;
    }

    public function setOverwriteFuncGetArgs(bool $overwriteFuncGetArgs): self
    {
        $this->overwriteFuncGetArgs = $overwriteFuncGetArgs;
        return $this;
    }

    public function isOverwriteSandboxedStringFuncs(): bool
    {
        return $this->overwriteSandboxedStringFuncs;
    }

    public function setOverwriteSandboxedStringFuncs(bool $overwriteSandboxedStringFuncs): self
    {
        $this->overwriteSandboxedStringFuncs = $overwriteSandboxedStringFuncs;
        return $this;
    }

    public function isOverwriteSuperglobals(): bool
    {
        return $this->overwriteSuperglobals;
    }

    public function setOverwriteSuperglobals(bool $overwriteSuperglobals): self
    {
        $this->overwriteSuperglobals = $overwriteSuperglobals;
        return $this;
    }

    public function isAllowFunctions(): bool
    {
        return $this->allowFunctions;
    }

    public function setAllowFunctions(bool $allowFunctions): self
    {
        $this->allowFunctions = $allowFunctions;
        return $this;
    }

    public function isAllowClosures(): bool
    {
        return $this->allowClosures;
    }

    public function setAllowClosures(bool $allowClosures): self
    {
        $this->allowClosures = $allowClosures;
        return $this;
    }

    public function isAllowVariables(): bool
    {
        return $this->allowVariables;
    }

    public function setAllowVariables(bool $allowVariables): self
    {
        $this->allowVariables = $allowVariables;
        return $this;
    }

    public function isAllowStaticVariables(): bool
    {
        return $this->allowStaticVariables;
    }

    public function setAllowStaticVariables(bool $allowStaticVariables): self
    {
        $this->allowStaticVariables = $allowStaticVariables;
        return $this;
    }

    public function isAllowObjects(): bool
    {
        return $this->allowObjects;
    }

    public function setAllowObjects(bool $allowObjects): self
    {
        $this->allowObjects = $allowObjects;
        return $this;
    }

    public function isAllowConstants(): bool
    {
        return $this->allowConstants;
    }

    public function setAllowConstants(bool $allowConstants): self
    {
        $this->allowConstants = $allowConstants;
        return $this;
    }

    public function isAllowGlobals(): bool
    {
        return $this->allowGlobals;
    }

    public function setAllowGlobals(bool $allowGlobals): self
    {
        $this->allowGlobals = $allowGlobals;
        return $this;
    }

    public function isAllowNamespaces(): bool
    {
        return $this->allowNamespaces;
    }

    public function setAllowNamespaces(bool $allowNamespaces): self
    {
        $this->allowNamespaces = $allowNamespaces;
        return $this;
    }

    public function isAllowAliases(): bool
    {
        return $this->allowAliases;
    }

    public function setAllowAliases(bool $allowAliases): self
    {
        $this->allowAliases = $allowAliases;
        return $this;
    }

    public function isAllowClasses(): bool
    {
        return $this->allowClasses;
    }

    public function setAllowClasses(bool $allowClasses): self
    {
        $this->allowClasses = $allowClasses;
        return $this;
    }

    public function isAllowInterfaces(): bool
    {
        return $this->allowInterfaces;
    }

    public function setAllowInterfaces(bool $allowInterfaces): self
    {
        $this->allowInterfaces = $allowInterfaces;
        return $this;
    }

    public function isAllowTraits(): bool
    {
        return $this->allowTraits;
    }

    public function setAllowTraits(bool $allowTraits): self
    {
        $this->allowTraits = $allowTraits;
        return $this;
    }

    public function isAllowGenerators(): bool
    {
        return $this->allowGenerators;
    }

    public function setAllowGenerators(bool $allowGenerators): self
    {
        $this->allowGenerators = $allowGenerators;
        return $this;
    }

    public function isAllowEscaping(): bool
    {
        return $this->allowEscaping;
    }

    public function setAllowEscaping(bool $allowEscaping): self
    {
        $this->allowEscaping = $allowEscaping;
        return $this;
    }

    public function isAllowCasting(): bool
    {
        return $this->allowCasting;
    }

    public function setAllowCasting(bool $allowCasting): self
    {
        $this->allowCasting = $allowCasting;
        return $this;
    }

    public function isAllowErrorSuppressing(): bool
    {
        return $this->allowErrorSuppressing;
    }

    public function setAllowErrorSuppressing(bool $allowErrorSuppressing): self
    {
        $this->allowErrorSuppressing = $allowErrorSuppressing;
        return $this;
    }

    public function isAllowReferences(): bool
    {
        return $this->allowReferences;
    }

    public function setAllowReferences(bool $allowReferences): self
    {
        $this->allowReferences = $allowReferences;
        return $this;
    }

    public function isAllowBackticks(): bool
    {
        return $this->allowBackticks;
    }

    public function setAllowBackticks(bool $allowBackticks): self
    {
        $this->allowBackticks = $allowBackticks;
        return $this;
    }

    public function isAllowHalting(): bool
    {
        return $this->allowHalting;
    }

    public function setAllowHalting(bool $allowHalting): self
    {
        $this->allowHalting = $allowHalting;
        return $this;
    }

    public function isSandboxStrings(): bool
    {
        return $this->sandboxStrings;
    }

    public function setSandboxStrings(bool $sandboxStrings): self
    {
        $this->sandboxStrings = $sandboxStrings;
        return $this;
    }

    /** Get error handler.
     *
     * This function returns the sandbox error handler.
     */
    public function getErrorHandler(): ?callable
    {
        return $this->errorHandler;
    }

    /** Set callable to handle errors.
     *
     * This function sets the sandbox error handler and the handled error types. The handler accepts the error number,
     * the error message, the error file, the error line, the error context and the sandbox instance as arguments.
     * If the error handler does not handle errors correctly then the sandbox's security may become compromised!
     *
     * }, E_ALL);  //ignore all errors, INSECURE
     *
     * @param callable $handler Callable to handle thrown Errors
     * @param int $error_types Integer flag of the error types to handle (default is E_ALL)
     *
     * @return SandboxOptions Returns the PHPSandbox instance for fluent querying
     */
    public function setErrorHandler(callable $handler, int $error_types = E_ALL): self
    {
        $this->errorHandler = $handler;
        $this->errorHandlerTypes = $error_types;
        return $this;
    }

    public function getErrorHandlerTypes(): int
    {
        return $this->errorHandlerTypes;
    }

    public function setErrorHandlerTypes(int $errorHandlerTypes): self
    {
        $this->errorHandlerTypes = $errorHandlerTypes;
        return $this;
    }

    /** Unset error handler.
     *
     * This function unsets the sandbox error handler.
     *
     * @return self Returns the PHPSandbox instance for fluent querying
     */
    public function unsetErrorHandler(): self
    {
        $this->errorHandler = null;
        return $this;
    }

    /** Get exception handler.
     *
     * This function returns the sandbox exception handler.
     */
    public function getExceptionHandler(): ?callable
    {
        return $this->exceptionHandler;
    }

    /** Set callable to handle thrown exceptions.
     *
     * This function sets the sandbox exception handler. The handler accepts the thrown exception and the sandbox instance
     * as arguments. If the exception handler does not handle exceptions correctly then the sandbox's security may
     * become compromised!
     *
     * @param null|callable $handler Callable to handle thrown exceptions
     *
     * @return SandboxOptions Returns the PHPSandbox instance for fluent querying
     */
    public function setExceptionHandler(?callable $handler): self
    {
        $this->exceptionHandler = $handler;
        return $this;
    }

    /** Unset exception handler.
     *
     * This function unsets the sandbox exception handler.
     *
     * @return SandboxOptions Returns the PHPSandbox instance for fluent querying
     */
    public function unsetExceptionHandler(): self
    {
        $this->exceptionHandler = null;
        return $this;
    }

    public function definitions(): ?Definitions
    {
        return $this->definitions;
    }

    public function setDefinitions(Definitions $definitions): self
    {
        $definitions->setValidationError($this->validationError);
        $this->definitions = $definitions;
        return $this;
    }

    public function getValidationError(): ?ValidationError
    {
        return $this->validationError;
    }

    public function setValidationError(ValidationError $validationError): self
    {
        $this->validationError = $validationError;
        if ($this->definitions) {
            $this->definitions->setValidationError($this->validationError);
        }
        return $this;
    }

    public function accessControl(): ?AccessControl
    {
        return $this->accessControl;
    }

    public function setAccessControl(?AccessControl $accessControl): self
    {
        $this->accessControl = $accessControl;
        return $this;
    }

    public function validation(): ?Validation
    {
        return $this->validation;
    }

    public function setValidation(Validation $validation): self
    {
        $this->validation = $validation;
        return $this;
    }

    public function cache(): ?CacheItemPoolInterface
    {
        return $this->cache;
    }

    public function setCache(CacheItemPoolInterface $cache): SandboxOptions
    {
        $this->cache = $cache;
        return $this;
    }

    /** Set PHPSandbox options by array.
     *
     * You can pass an array of option names to set to $value, or an associative array of option names and their values to set.
     *
     * @param array $options Array of strings or associative array of keys of option names to set $value to, or JSON array or string template to import
     * @param null|bool|int $value Boolean, integer or null $value to set $option to (optional)
     *
     * @return SandboxOptions Returns the SandboxOptions instance for fluent querying
     */
    public function setOptions(array $options, $value = null): self
    {
        //        Options 模式下，不支持import导入
        //        if (is_string($options) || (is_array($options) && isset($options['options']))) {
        //            return $this->import($options);
        //        }
        foreach ($options as $name => $_value) {
            $this->setOption(is_int($name) ? $_value : $name, is_int($name) ? $value : $_value);
        }
        return $this;
    }

    /** Set PHPSandbox option.
     *
     * You can pass an $option name to set to $value, an array of $option names to set to $value, or an associative array of $option names and their values to set.
     *
     * @param array|string $option String or array of strings or associative array of keys of option names to set $value to
     * @param null|bool|int $value Boolean, integer or null $value to set $option to (optional)
     *
     * @return SandboxOptions Returns the SandboxOptions instance for fluent querying
     */
    public function setOption($option, $value = null): self
    {
        if (is_array($option)) {
            return $this->setOptions($option, $value);
        }
        //        $option = strtolower($option); // normalize option names
        switch ($option) {
            case 'errorLevel':
                $this->errorLevel = is_numeric($value) ? intval($value) : null;
                break;
            case 'timeLimit':
                $this->timeLimit = is_numeric($value) ? intval($value) : null;
                break;
            case 'validateFunctions':
            case 'validateVariables':
            case 'validateGlobals':
            case 'validateSuperglobals':
            case 'validateConstants':
            case 'validateMagicConstants':
            case 'validateNamespaces':
            case 'validateAliases':
            case 'validateClasses':
            case 'validateInterfaces':
            case 'validateTraits':
            case 'validateKeywords':
            case 'validateOperators':
            case 'validatePrimitives':
            case 'validateTypes':
            case 'sandboxIncludes':
            case 'restoreErrorLevel':
            case 'convertErrors':
            case 'captureOutput':
            case 'autoWhitelistTrustedCode':
            case 'autoWhitelistFunctions':
            case 'autoWhitelistConstants':
            case 'autoWhitelistGlobals':
            case 'autoWhitelistClasses':
            case 'autoWhitelistInterfaces':
            case 'autoWhitelistTraits':
            case 'autoDefineVars':
            case 'overwriteDefinedFuncs':
            case 'overwriteSandboxedStringFuncs':
            case 'overwriteFuncGetArgs':
            case 'overwriteSuperglobals':
            case 'allowFunctions':
            case 'allowClosures':
            case 'allowVariables':
            case 'allowStaticVariables':
            case 'allowObjects':
            case 'allowConstants':
            case 'allowGlobals':
            case 'allowNamespaces':
            case 'allowAliases':
            case 'allowClasses':
            case 'allowInterfaces':
            case 'allowTraits':
            case 'allowGenerators':
            case 'allowEscaping':
            case 'allowCasting':
            case 'allowErrorSuppressing':
            case 'allowReferences':
            case 'allowBackticks':
            case 'allowHalting':
            case 'sandboxStrings':
                $this->{$option} = (bool) $value;
                break;
            case 'name':
                $this->{$option} = (string) $value;
                break;
        }
        return $this;
    }

    /** Reset PHPSandbox options to their default values.
     *
     * @return SandboxOptions Returns the SandboxOptions instance for fluent querying
     */
    public function resetOptions(): self
    {
        foreach (get_class_vars(__CLASS__) as $option => $value) {
            if ($option == 'errorLevel' || is_bool($value)) {
                $this->setOption($option, $value);
            }
        }
        return $this;
    }

    /** Get PHPSandbox option.
     *
     * You pass a string $option name to get its associated value
     *
     * @param string $option String of $option name to get
     *
     * @return null|bool|int Returns the value of the requested option
     */
    public function getOption(string $option)
    {
        //        $option = strtolower($option);  // normalize option names
        switch ($option) {
            case 'validateFunctions':
            case 'validateVariables':
            case 'validateGlobals':
            case 'validateSuperglobals':
            case 'validateConstants':
            case 'validateMagicConstants':
            case 'validateNamespaces':
            case 'validateAliases':
            case 'validateClasses':
            case 'validateInterfaces':
            case 'validateTraits':
            case 'validateKeywords':
            case 'validateOperators':
            case 'validatePrimitives':
            case 'validateTypes':
            case 'errorLevel':
            case 'timeLimit':
            case 'sandboxIncludes':
            case 'restoreErrorLevel':
            case 'convertErrors':
            case 'captureOutput':
            case 'autoWhitelistTrustedCode':
            case 'autoWhitelistFunctions':
            case 'autoWhitelistConstants':
            case 'autoWhitelistGlobals':
            case 'autoWhitelistClasses':
            case 'autoWhitelistInterfaces':
            case 'autoWhitelistTraits':
            case 'autoDefineVars':
            case 'overwriteDefinedFuncs':
            case 'overwriteSandboxedStringFuncs':
            case 'overwriteFuncGetArgs':
            case 'overwriteSuperglobals':
            case 'allowFunctions':
            case 'allowClosures':
            case 'allowVariables':
            case 'allowStaticVariables':
            case 'allowObjects':
            case 'allowConstants':
            case 'allowGlobals':
            case 'allowNamespaces':
            case 'allowAliases':
            case 'allowClasses':
            case 'allowInterfaces':
            case 'allowTraits':
            case 'allowGenerators':
            case 'allowEscaping':
            case 'allowCasting':
            case 'allowErrorSuppressing':
            case 'allowReferences':
            case 'allowBackticks':
            case 'allowHalting':
            case 'sandboxStrings':
            case 'name':
                return $this->{$option};
        }
        return null;
    }
}
