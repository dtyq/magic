<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO\Node;

use App\Interfaces\Flow\DTO\AbstractFlowDTO;
use Dtyq\FlowExprEngine\Component;

class NodeOutputDTO extends AbstractFlowDTO
{
    public ?Component $widget = null;

    public ?Component $form = null;

    public function getWidget(): ?Component
    {
        return $this->widget;
    }

    public function setWidget(mixed $widget): void
    {
        $this->widget = $this->createComponent($widget);
    }

    public function getForm(): ?Component
    {
        return $this->form;
    }

    public function setForm(mixed $form): void
    {
        $this->form = $this->createComponent($form);
    }
}
