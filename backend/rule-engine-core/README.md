# Motore di Regole Core ⚙️

## ✅ Funzionalità Implementate

1. Traduzione delle specifiche JSR-94
2. Servizio di regole di tipo script PHP

## 📝 Esempi

### Registrazione del Servizio di Regole

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;

$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$container = ApplicationContext::getContainer();
RuleServiceProviderManager::registerRuleServiceProvider($uri, RuleServiceProvider::class, $container);
```

Il repository delle regole script PHP predefinito è efficace a livello di processo (repository funzioni) e coroutine (gruppo regole). Se è necessario un repository personalizzato (ad esempio utilizzando cache o DB per l'archiviazione), è possibile utilizzare il seguente metodo per la sostituzione.

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;

$provider = new RuleServiceProvider();
$provider
    ->setExecutionSetRepository(new CustomExecutionSetRepository())  //Utilizzo repository gruppo regole personalizzato
    ->setFunctionRepository(new CustomFunctionRepository());  	//Utilizzo repository funzioni personalizzato
$container = ApplicationContext::getContainer();
RuleServiceProviderManager::registerRuleServiceProvider(RuleServiceProvider::RULE_SERVICE_PROVIDER, $provider, $container);
```

I repository di funzioni e gruppi di regole devono implementare `\Dtyq\RuleEngineCore\PhpScript\Repository\ExpressionFunctionRepositoryInterface` e `\Dtyq\RuleEngineCore\PhpScript\Repository\RuleExecutionSetRepositoryInterface`.

Inoltre, si consiglia di registrare il servizio di regole all'avvio del framework. L'esempio seguente completa la registrazione del servizio di regole ascoltando gli eventi del framework.

```php
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Utils\ApplicationContext;
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Hyperf\Event\Annotation\Listener;

#[Listener]
class AutoRegister implements ListenerInterface
{
    public function listen(): array
    {
        return [
            \Hyperf\Framework\Event\BootApplication::class,
        ];
    }

    public function process(object $event): void
    {
        $uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
        $container = ApplicationContext::getContainer();
        RuleServiceProviderManager::registerRuleServiceProvider($uri, RuleServiceProvider::class, $container);
    }
}
```

### Registrazione delle Funzioni

Gli script e le espressioni per default proibiscono l'esecuzione di qualsiasi funzione, gli utenti possono registrarle tramite il seguente metodo.

```php
$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$executableCode = new ExecutableFunction('add', function ($arg1, $arg2) {
    return $arg1 + $arg2;
});
$admin->registerExecutableCode($executableCode);
```

Metodo di registrazione rapida basato sulle funzioni native PHP:

```php
$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$executableCode = ExecutableFunction::fromPhp('is_array', 'is_array2'); //Nello script è necessario utilizzare is_array2 per la chiamata
$admin->registerExecutableCode($executableCode);
```

Da notare, si prega di non scrivere codice che potrebbe causare il cambio di coroutine all'interno delle funzioni.

### Registrazione del Gruppo di Esecuzione Regole

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\PhpScript\RuleType;

$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider(InputType::from(InputType::String));
$input = ['$a + $b'];  //Contenuto script o espressione
$properties = new RuleExecutionSetProperties();
$properties->setName('add-rule');
$properties->setRuleType(RuleType::Expression); // Tipo di regola, supporta script o tipo espressione. Se non definito, è script per default.
$set = $ruleExecutionSetProvider->createRuleExecutionSet($input, $properties);
$admin->registerRuleExecutionSet('mysample', $set, $properties);
```

### Esecuzione del Gruppo di Regole

```php
use Dtyq\RuleEngineCore\Standards\RuleSessionType;

$runtime = $ruleProvider->getRuleRuntime();
$properties = new RuleExecutionSetProperties();
$ruleSession = $runtime->createRuleSession('mysample', $properties, RuleSessionType::from(RuleSessionType::Stateless));
$inputs = [];
$inputs['a'] = 1;
$inputs['b'] = 2;
$res = $ruleSession->executeRules($inputs);
$ruleSession->release();
```

### Albero Sintassi Astratta (AST)

Quando non esistono segnaposto nella regola, l'analisi sintattica verrà eseguita durante la creazione del gruppo di regole, a quel punto sarà possibile ottenere l'albero sintassi astratta (AST).

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;

$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider(InputType::from(InputType::String));
$input = ['$a + $b'];  //Non contiene segnaposto
$properties = new RuleExecutionSetProperties();
$properties->setName('add-rule');
$properties->setRuleType(RuleType::Expression); // Tipo di regola, supporta script o tipo espressione. Se non definito, è script per default.
$set = $ruleExecutionSetProvider->createRuleExecutionSet($input, $properties);
//Eseguire azioni di validazione di analisi personalizzate
$ast = $set->getAsts();
$traverser = new NodeTraverser();
$visitor = new class() extends NodeVisitorAbstract {
	public function leaveNode(Node $node)
	{
		var_dump($node);
	}
};
$traverser->addVisitor($visitor);
foreach ($ast as $stmts) {
	$traverser->traverse($stmts);
}
```

Se la regola contiene segnaposto, è necessario attendere la fase di esecuzione delle regole per ottenere l'albero sintassi astratta (AST).

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;

$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider(InputType::from(InputType::String));
$input = ['if( {{ruleEnableCondition}} ) return $so;'];  //Contiene segnaposto
$properties = new RuleExecutionSetProperties();
$properties->setName('testPlaceholder-rule');
$properties->setRuleType(RuleType::Script); // Tipo di regola, supporta script o tipo espressione. Se non definito, è script per default.
$properties->setResolvePlaceholders(true);
$set = $ruleExecutionSetProvider->createRuleExecutionSet($input, $properties);
$admin->registerRuleExecutionSet('mysample', $set, $properties);
//Dopo la registrazione, passare le informazioni segnaposto e i fatti per preparare l'esecuzione delle regole
$runtime = $ruleProvider->getRuleRuntime();
$properties = new RuleExecutionSetProperties();
$properties->setPlaceholders(['ruleEnableCondition' => '1 == 1']);
$ruleSession = $runtime->createRuleSession('mysample', $properties, RuleSessionType::from(RuleSessionType::Stateless));
$inputs = [];
$inputs['so'] = 'aaaa111122';
$res = $ruleSession->getAsts();
$traverser = new NodeTraverser();
$visitor = new class() extends NodeVisitorAbstract {
	public function leaveNode(Node $node)
	{
		var_dump($node);
	}
};
$traverser->addVisitor($visitor);
foreach ($res as $stmts) {
	$traverser->traverse($stmts);
}
```

---

# rule engine core

## 已实现功能

1. JSR-94规范翻译
2. PHP脚本类型规则服务

## 示例

### 注册规则服务

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;

$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER; 
$container = ApplicationContext::getContainer();
RuleServiceProviderManager::registerRuleServiceProvider($uri, RuleServiceProvider::class, $container);
```

默认PHP脚本规则的仓储为进程（函数仓储）及协程（规则组）级别生效。若需自定义仓储（如改用缓存或DB进行储存），可使用以下方式进行替换。

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;

$provider = new RuleServiceProvider();
$provider
    ->setExecutionSetRepository(new CustomExecutionSetRepository())  //使用自定义的规则组仓储
    ->setFunctionRepository(new CustomFunctionRepository());  	//使用自定义的函数仓储
$container = ApplicationContext::getContainer();
RuleServiceProviderManager::registerRuleServiceProvider(RuleServiceProvider::RULE_SERVICE_PROVIDER, $provider, $container);
```

函数及规则组仓储需要实现`\Dtyq\RuleEngineCore\PhpScript\Repository\ExpressionFunctionRepositoryInterface`及`\Dtyq\RuleEngineCore\PhpScript\Repository\RuleExecutionSetRepositoryInterface`。

另外，建议在框架启动时进行规则服务注册。以下例子通过监听框架事件完成规则服务注册。

```php
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Utils\ApplicationContext;
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Hyperf\Event\Annotation\Listener;

#[Listener]
class AutoRegister implements ListenerInterface
{
    public function listen(): array
    {
        return [
            \Hyperf\Framework\Event\BootApplication::class,
        ];
    }

    public function process(object $event): void
    {
        $uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$container = ApplicationContext::getContainer();
RuleServiceProviderManager::registerRuleServiceProvider($uri, RuleServiceProvider::class, $container);
    }
}
```



### 注册函数

脚本及表达式内默认禁止运行任何函数，用户可通过以下方式进行注册。

```php
$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$executableCode = new ExecutableFunction('add', function ($arg1, $arg2) {
    return $arg1 + $arg2;
});
$admin->registerExecutableCode($executableCode);
```

基于php原生函数的快捷注册方式：

```php
$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$executableCode = ExecutableFunction::fromPhp('is_array', 'is_array2'); //在脚本中需使用is_array2进行调用
$admin->registerExecutableCode($executableCode);
```

需注意，请勿在函数内编写可能导致协程切换的代码。


### 注册规则执行组

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\PhpScript\RuleType;

$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider(InputType::from(InputType::String));
$input = ['$a + $b'];  //脚本或表达式内容
$properties = new RuleExecutionSetProperties();
$properties->setName('add-rule');
$properties->setRuleType(RuleType::Expression); // 规则类型，支持脚本或表达式类型。未进行定义时，默认为脚本类型。
$set = $ruleExecutionSetProvider->createRuleExecutionSet($input, $properties);
$admin->registerRuleExecutionSet('mysample', $set, $properties);
```



### 执行规则组

```php
use Dtyq\RuleEngineCore\Standards\RuleSessionType;

$runtime = $ruleProvider->getRuleRuntime();
$properties = new RuleExecutionSetProperties();
$ruleSession = $runtime->createRuleSession('mysample', $properties, RuleSessionType::from(RuleSessionType::Stateless));
$inputs = [];
$inputs['a'] = 1;
$inputs['b'] = 2;
$res = $ruleSession->executeRules($inputs);
$ruleSession->release();
```



### AST语法树

当规则中不存在占位符时，将在创建规则组时进行语法解析，此时将可获得AST语法树。

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;

$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider(InputType::from(InputType::String));
$input = ['$a + $b'];  //未包含占位符
$properties = new RuleExecutionSetProperties();
$properties->setName('add-rule');
$properties->setRuleType(RuleType::Expression); // 规则类型，支持脚本或表达式类型。未进行定义时，默认为脚本类型。
$set = $ruleExecutionSetProvider->createRuleExecutionSet($input, $properties);
//进行自定义解析验证动作
$ast = $set->getAsts();
$traverser = new NodeTraverser();
$visitor = new class() extends NodeVisitorAbstract {
	public function leaveNode(Node $node)
	{
		var_dump($node);
	}
};
$traverser->addVisitor($visitor);
foreach ($ast as $stmts) {
	$traverser->traverse($stmts);
}

```

若规则存在占位符时，需要在规则执行阶段才可获取AST语法树。

```php
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Dtyq\RuleEngineCore\Standards\Admin\InputType;
use Dtyq\RuleEngineCore\PhpScript\RuleType;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;

$uri = RuleServiceProvider::RULE_SERVICE_PROVIDER;
$ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
$admin = $ruleProvider->getRuleAdministrator();
$ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider(InputType::from(InputType::String));
$input = ['if( {{ruleEnableCondition}} ) return $so;'];  //包含占位符
$properties = new RuleExecutionSetProperties();
$properties->setName('testPlaceholder-rule');
$properties->setRuleType(RuleType::Script); // 规则类型，支持脚本或表达式类型。未进行定义时，默认为脚本类型。
$properties->setResolvePlaceholders(true);
$set = $ruleExecutionSetProvider->createRuleExecutionSet($input, $properties);
$admin->registerRuleExecutionSet('mysample', $set, $properties);
//注册完毕后，传入占位信息及事实准备执行规则
$runtime = $ruleProvider->getRuleRuntime();
$properties = new RuleExecutionSetProperties();
$properties->setPlaceholders(['ruleEnableCondition' => '1 == 1']);
$ruleSession = $runtime->createRuleSession('mysample', $properties, RuleSessionType::from(RuleSessionType::Stateless));
$inputs = [];
$inputs['so'] = 'aaaa111122';
$res = $ruleSession->getAsts();
$traverser = new NodeTraverser();
$visitor = new class() extends NodeVisitorAbstract {
	public function leaveNode(Node $node)
	{
		var_dump($node);
	}
};
$traverser->addVisitor($visitor);
foreach ($res as $stmts) {
	$traverser->traverse($stmts);
}

```

