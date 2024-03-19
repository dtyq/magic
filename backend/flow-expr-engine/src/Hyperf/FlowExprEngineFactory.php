<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Hyperf;

use Dtyq\FlowExprEngine\ComponentContext;
use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\PHPSandboxRuleEngineClient;
use Dtyq\FlowExprEngine\SdkInfo;
use Dtyq\FlowExprEngine\Structure\CodeRunner;
use Dtyq\SdkBase\SdkBase;
use Hyperf\Contract\ConfigInterface;
use Psr\Container\ContainerInterface;

class FlowExprEngineFactory
{
    protected ContainerInterface $container;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
    }

    public function register(): void
    {
        if (! ComponentContext::hasSdkContainer()) {
            // 注册 SdkContainer
            ComponentContext::register($this->createSdkContainer());
            // 注册表达式运行器
            CodeRunner::register($this->getPHPSandboxRuleEngine());
        }
    }

    private function createSdkContainer(): SdkBase
    {
        $configs = $this->container->get(ConfigInterface::class)->get('flow_expr_engine');

        $config = [
            'sdk_name' => SdkInfo::NAME,
            'exception_class' => FlowExprEngineException::class,
            'flow_expr_engine' => $configs,
        ];

        return new SdkBase($this->container, $config);
    }

    private function getPHPSandboxRuleEngine(): PHPSandboxRuleEngineClient
    {
        return new PHPSandboxRuleEngineClient();
    }
}
