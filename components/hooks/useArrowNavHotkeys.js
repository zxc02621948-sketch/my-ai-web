import { useEffect } from "react";

/**
 * 啟用全域左右鍵切換，但在「輸入情境」與「IME 組字中」時自動忽略。
 * @param {{ enabled: boolean, onPrev?: () => void, onNext?: () => void }} opts
 */
export default function useArrowNavHotkeys({ enabled, onPrev, onNext }) {
  useEffect(() => {
    if (!enabled) return;

    const isTypingElement = (el) => {
      if (!el) return false;
      const tag = el.tagName?.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      // 無障礙：有些自訂輸入會用 role=textbox
      const role = el.getAttribute?.("role");
      if (role === "textbox" || role === "combobox" || role === "searchbox") return true;
      return false;
    };

    const shouldIgnore = (e) => {
      // 有修飾鍵時不處理（避免和瀏覽器/系統快捷鍵衝突）
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return true;

      // 若事件目標或目前焦點在可輸入區，忽略
      if (isTypingElement(e.target) || isTypingElement(document.activeElement)) return true;

      // IME 組字（新注音/注音/倉頡/日文等）時，鍵盤事件應交給輸入法
      // isComposing: 標準屬性；key === 'Process' 或 keyCode 229：部分瀏覽器行為
      if (e.isComposing || e.key === "Process" || e.keyCode === 229) return true;

      return false;
    };

    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;

      const key = e.key;
      if (key !== "ArrowLeft" && key !== "ArrowRight") return;
      if (shouldIgnore(e)) return;

      // 到這裡才吃下事件
      e.preventDefault();
      e.stopPropagation();

      if (key === "ArrowLeft" && onPrev) onPrev();
      if (key === "ArrowRight" && onNext) onNext();
    };

    // 用 capture 提前攔截，避免其他 listener 先處理
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, onPrev, onNext]);
}
