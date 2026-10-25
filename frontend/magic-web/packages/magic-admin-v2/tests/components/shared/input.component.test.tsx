import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "@magic-admin-v2/components/ui/input";

describe("Input", () => {
  it("moves the caret to the end after focusing text input", () => {
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });
    const setSelectionRange = vi.spyOn(HTMLInputElement.prototype, "setSelectionRange");

    render(<Input defaultValue="existing value" />);
    fireEvent.focus(screen.getByRole("textbox"));

    expect(setSelectionRange).toHaveBeenCalledWith(14, 14);

    requestAnimationFrame.mockRestore();
    setSelectionRange.mockRestore();
  });

  it("preserves the caller focus handler", () => {
    const onFocus = vi.fn();

    render(<Input onFocus={onFocus} />);
    fireEvent.focus(screen.getByRole("textbox"));

    expect(onFocus).toHaveBeenCalledOnce();
  });

  it("does not set a text selection for non-text input types", () => {
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame");

    render(<Input type="number" defaultValue="123" />);
    fireEvent.focus(screen.getByRole("spinbutton"));

    expect(requestAnimationFrame).not.toHaveBeenCalled();

    requestAnimationFrame.mockRestore();
  });
});
