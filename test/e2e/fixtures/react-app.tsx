import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { OrbChart, type OrbChartHandle } from "../../../dist/react.mjs";

declare global {
  interface Window {
    handle: { current: OrbChartHandle | null };
    rerender: () => void;
    popLog: string[];
  }
}

const data = [
  { id: "a", label: "Alpha", value: 100 },
  { id: "b", label: "Beta", value: 50 },
];
window.popLog = [];

// New inline callback and new option values on every render.
function App() {
  const ref = useRef<OrbChartHandle>(null);
  const [render, setRender] = useState(0);
  window.handle = ref;
  window.rerender = () => setRender((n) => n + 1);
  return (
    <div style={{ width: 400, height: 300 }}>
      <OrbChart
        ref={ref}
        data={data}
        popOnClick
        popStyle="ghost"
        theme="dark"
        fontFamily="Nunito, sans-serif"
        transitionDuration={0}
        onOrbPop={(orb) => window.popLog.push(`${orb.id}@${render}`)}
      />
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
