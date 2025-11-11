"use client";

import { Listbox, Transition } from "@headlessui/react";
import { Fragment, useMemo, useRef, useState } from "react";

const MAX_VISIBLE_OPTIONS = 8;
const OPTION_HEIGHT = 36;
const DROPDOWN_PADDING = 16;
const DEFAULT_FLIP_BUFFER = 32; // 額外保留的底部空間（px）

export default function SelectField({
  value,
  onChange,
  options = [],
  placeholder = "請選擇",
  className = "",
  buttonClassName = "",
  disabled = false,
  invalid = false,
  name,
  placement = "auto", // "auto" | "top" | "bottom"
  flipBuffer = DEFAULT_FLIP_BUFFER,
}) {
  const buttonRef = useRef(null);
  const [computedPlacement, setComputedPlacement] = useState(
    placement === "top" ? "top" : "bottom",
  );

  const selectedOption =
    options.find((opt) => opt.value === value) ?? null;

  const estimatedDropdownHeight = useMemo(() => {
    const visibleCount = Math.min(options.length || 1, MAX_VISIBLE_OPTIONS);
    return visibleCount * OPTION_HEIGHT + DROPDOWN_PADDING;
  }, [options.length]);

  const decidePlacement = () => {
    if (placement === "top" || placement === "bottom") {
      return placement;
    }
    if (!buttonRef.current) {
      return "bottom";
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (
      spaceBelow < estimatedDropdownHeight + flipBuffer &&
      spaceAbove > spaceBelow
    ) {
      return "top";
    }
    return "bottom";
  };

  const handleBeforeToggle = () => {
    setComputedPlacement(decidePlacement());
  };

  const handleKeyDownCapture = (event) => {
    if (event.defaultPrevented) return;
    if ([" ", "Enter", "ArrowDown", "ArrowUp"].includes(event.key)) {
      setComputedPlacement(decidePlacement());
    }
  };

  const optionsPositionClass =
    computedPlacement === "top"
      ? "bottom-full mb-2 origin-bottom"
      : "top-full mt-2 origin-top";

  return (
    <div className={`relative ${className}`}>
      <Listbox
        value={selectedOption ? selectedOption.value : value ?? null}
        onChange={(val) => onChange?.(val)}
        disabled={disabled}
        name={name}
      >
        {({ open }) => (
          <>
            {open && (() => {
              const nextPlacement = decidePlacement();
              if (nextPlacement !== computedPlacement) {
                setComputedPlacement(nextPlacement);
              }
              return null;
            })()}
            <Listbox.Button
              ref={buttonRef}
              onMouseDownCapture={handleBeforeToggle}
              onPointerDownCapture={handleBeforeToggle}
              onKeyDownCapture={handleKeyDownCapture}
              className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:bg-white/5"
              } ${invalid ? "border-red-500/80" : "border-white/10"} ${buttonClassName}`}
            >
              <span
                className={`truncate ${
                  selectedOption ? "text-white" : "text-zinc-400"
                }`}
              >
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-zinc-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.204l3.71-2.973a.75.75 0 111.04 1.081l-4.25 3.404a.75.75 0 01-.96 0l-4.25-3.404a.75.75 0 01-1.05-1.104z"
                  clipRule="evenodd"
                />
              </svg>
            </Listbox.Button>
            <Transition
              as={Fragment}
              show={open}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Listbox.Options
                className={`absolute z-[12000] max-h-60 w-full overflow-auto rounded-md border border-white/10 bg-[#161616] py-1 text-sm shadow-lg focus:outline-none ${optionsPositionClass}`}
              >
                {options.length === 0 ? (
                  <div className="px-3 py-2 text-zinc-400">
                    沒有可用選項
                  </div>
                ) : (
                  options.map((opt) => (
                    <Listbox.Option
                      key={opt.value ?? opt.label}
                      value={opt.value}
                      disabled={opt.disabled}
                      className={({ active, disabled: optDisabled, selected }) =>
                        `relative cursor-pointer select-none px-3 py-2 ${
                          optDisabled
                            ? "cursor-not-allowed text-zinc-600"
                            : active
                              ? "bg-white/10 text-white"
                              : "text-zinc-200"
                        } ${selected ? "bg-purple-600/40 text-white" : ""}`
                      }
                    >
                      {({ selected }) => (
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{opt.label}</span>
                          {selected && (
                            <svg
                              className="h-4 w-4 text-purple-400"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 011.414-1.414L8.75 11.836l6.543-6.542a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                      )}
                    </Listbox.Option>
                  ))
                )}
              </Listbox.Options>
            </Transition>
          </>
        )}
      </Listbox>
    </div>
  );
}

