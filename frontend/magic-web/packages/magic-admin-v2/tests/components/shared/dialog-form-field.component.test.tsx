import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DialogFormField } from "../../../src/components/form/dialog-form-field";
import { FieldError } from "../../../src/components/form/field-error";

describe("dialog form field", () => {
  it("renders the required marker and tooltip description", () => {
    const { container } = render(
      <DialogFormField
        description="Field guidance"
        fieldId="name"
        label="Name"
        required
      >
        <input id="name" />
      </DialogFormField>,
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Name").closest("label")).toHaveAttribute("for", "name");
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("id", "name");
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Field guidance" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Field guidance");
    expect(container.querySelector('[data-form-field="name"]')).toBeInTheDocument();
  });

  it("supports inline descriptions and optional error messages", () => {
    const { rerender } = render(
      <DialogFormField description="Inline guidance" descriptionMode="text" label="Name">
        <input aria-label="Name input" />
        <FieldError />
      </DialogFormField>,
    );

    expect(screen.getByText("Inline guidance")).toHaveClass("text-muted-foreground");
    expect(screen.queryByText("Required")).not.toBeInTheDocument();

    rerender(
      <DialogFormField label="Name">
        <input aria-label="Name input" />
        <FieldError className="text-sm" message="Required" />
      </DialogFormField>,
    );

    expect(screen.getByText("Required")).toHaveClass("text-sm", "text-destructive");
  });
});
