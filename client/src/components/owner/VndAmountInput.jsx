import { useLayoutEffect, useRef } from "react";
import { formatVndInput, parseVndInput, vndCaretPosition } from "../../utils/moneyInput";

export default function VndAmountInput({ value, onValueChange, className = "", ...props }) {
  const inputRef = useRef(null), pendingCaret = useRef(null);
  const formatted = formatVndInput(value);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (pendingCaret.current !== null && document.activeElement === input) input.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });
  const commit = (input, text, digitsBeforeCaret) => {
    const amount = parseVndInput(text);
    if (amount === null) {
      input.value = formatted;
      const caret = vndCaretPosition(formatted, digitsBeforeCaret);
      input.setSelectionRange(caret, caret);
      return;
    }
    pendingCaret.current = vndCaretPosition(formatVndInput(amount), digitsBeforeCaret);
    onValueChange(amount);
  };
  const onChange = event => {
    const input = event.currentTarget;
    const before = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, "").length;
    commit(input, input.value, before);
  };
  const onKeyDown = event => {
    const input = event.currentTarget, caret = input.selectionStart;
    if (event.ctrlKey || event.metaKey || event.altKey || caret !== input.selectionEnd) return;
    const backspace = event.key === "Backspace" && input.value[caret - 1] === ".";
    const forwardDelete = event.key === "Delete" && input.value[caret] === ".";
    if (!backspace && !forwardDelete) return;
    event.preventDefault();
    const before = input.value.slice(0, caret).replace(/\D/g, "").length;
    const digits = input.value.replace(/\D/g, ""), removeAt = backspace ? before - 1 : before;
    commit(input, digits.slice(0, removeAt) + digits.slice(removeAt + 1), backspace ? before - 1 : before);
  };
  return <input {...props} ref={inputRef} type="text" inputMode="numeric" pattern="[0-9]{1,3}([.][0-9]{3})*" autoComplete="off" maxLength={32} className={`perfume-money-input ${className}`.trim()} value={formatted} onChange={onChange} onKeyDown={onKeyDown} />;
}
