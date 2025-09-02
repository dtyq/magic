<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade\Sandbox;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\SuperMagicAgentAssembler;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class SuperMagicAgentSandboxApi extends AbstractSuperMagicSandboxApi
{
    #[Inject]
    protected SuperMagicAgentAppService $superMagicAgentAppService;

    public function show(string $code)
    {
        $authorization = $this->getAuthorization();
        $withToolScheme = (bool) $this->request->input('with_tool_scheme', false);
        $entity = $this->superMagicAgentAppService->show($authorization, $code, $withToolScheme);
        $withPromptString = (bool) $this->request->input('with_prompt_string', false);
        return SuperMagicAgentAssembler::createDTO($entity, [], $withPromptString);
    }
}
