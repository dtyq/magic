<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use Dtyq\FlowExprEngine\Component;

class NodeOutput extends AbstractValueObject
{
    protected ?Component $widget = null;

    protected ?Component $form = null;

    public function getFormComponent(): ?Component
    {
        return $this->form;
    }

    public function getWidget(): ?Component
    {
        return $this->widget;
    }

    public function setWidget(?Component $widget): void
    {
        $this->widget = $widget;
    }

    public function getForm(): ?Component
    {
        return $this->form;
    }

    public function setForm(?Component $form): void
    {
        $this->form = $form;
    }
}
