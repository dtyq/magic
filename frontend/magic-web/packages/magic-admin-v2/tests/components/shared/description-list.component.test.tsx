import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DescriptionList, EditableDescriptionList } from "../../../src/components/description-list";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("description list components", () => {
  it("uses the unified read-only layout and preserves long text wrapping", () => {
    render(
      <DescriptionList
        items={[
          ["Empty", ""],
          ["Long text", "A long value that should wrap within the content column."],
        ]}
      />,
    );

    const longText = screen.getByText("A long value that should wrap within the content column.");
    const row = longText.closest("div");

    expect(row).toHaveClass("grid", "gap-3", "px-4", "py-4", "md:grid-cols-[200px_1fr]");
    expect(longText).toHaveClass("whitespace-pre-wrap", "break-words");
    expect(screen.getByText("common.emptyValue")).toBeInTheDocument();
  });

  it("uses the same spacing for editable controls and wraps field descriptions", () => {
    render(
      <EditableDescriptionList
        items={[
          [
            "Long label",
            <textarea aria-label="control" />,
            "A long field description that should wrap instead of widening the drawer.",
          ],
        ]}
      />,
    );

    const control = screen.getByLabelText("control");
    const row = control.closest("div")?.parentElement;
    const description = screen.getByText(
      "A long field description that should wrap instead of widening the drawer.",
    );

    expect(row).toHaveClass("grid", "gap-3", "px-4", "py-4", "md:grid-cols-[200px_1fr]");
    expect(description).toHaveClass("break-words");
  });
});
