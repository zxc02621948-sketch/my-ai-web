import { useRef, useEffect, useState } from "react";

export function usePortalContainer() {
  const [container, setContainer] = useState(null);
  const elRef = useRef(null);

  useEffect(() => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    elRef.current = div;
    setContainer(div);

    return () => {
      document.body.removeChild(div);
    };
  }, []);

  return container;
}
