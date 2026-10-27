import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import { OrbChart as OrbChartCore } from "@/core/OrbChart";
import type { Orb, OrbChartConfig, OrbDataInput } from "@/types/types";
import { diffConfig, type ConfigValues } from "@/react/diffConfig";
import { useLatest } from "@/react/useLatest";

/**
 * Every chart option plus `data`, `className`, and `style`. Keep `data` stable:
 * a new reference calls `setData`. Callbacks may change freely on each render.
 */
export interface OrbChartProps extends OrbChartConfig {
  /** Orbs to draw. Matched by `id` on every change of this reference. */
  data: OrbDataInput[];
  /** Class name of the container `div`. */
  className?: string;
  /** Style of the container `div`, which fills its parent by default. */
  style?: CSSProperties;
}

/** What a ref to `<OrbChart>` gives you; stable, and inert after unmount. */
export interface OrbChartHandle {
  /** Starts or resumes the animation. */
  start(): void;
  /** Pauses the animation; called before mount, the chart starts paused. */
  pause(): void;
  /** The live orbs (read only), without exiting ones; `[]` when unmounted. */
  getData(): Orb[];
  /** Pops bubble `id`, as `OrbChart.pop` does; `false` when unmounted. */
  pop(id: string): boolean;
  /** Brings back popped bubble `id`, or all; `false` when nothing came back. */
  restore(id?: string): boolean;
}

/**
 * React component for an OrbFlow chart. Renders one `div` on the server and
 * creates the canvas after mount. Use `ref` to get an {@link OrbChartHandle}.
 */
export const OrbChart = forwardRef<OrbChartHandle, OrbChartProps>(
  function OrbChart({ data, className, style, ...rest }, ref) {
    const {
      onOrbClick,
      onOrbHover,
      onDataIssue,
      onOrbPop,
      onOrbRestore,
      formatValue,
      ...config
    } = rest;
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<OrbChartCore | null>(null);
    const unmounted = useRef(false);
    const pendingPause = useRef(false);
    const appliedConfig = useRef<ConfigValues>(config);
    const appliedData = useRef(data);
    const callbacks = useLatest({
      onOrbClick,
      onOrbHover,
      onDataIssue,
      onOrbPop,
      onOrbRestore,
      formatValue,
    });
    const warnedFormat = useRef(false);

    useImperativeHandle(
      ref,
      () => ({
        start() {
          pendingPause.current = false;
          chartRef.current?.start();
        },
        pause() {
          if (chartRef.current) chartRef.current.pause();
          else if (!unmounted.current) pendingPause.current = true;
        },
        getData: () => chartRef.current?.getData() ?? [],
        pop: (id) => chartRef.current?.pop(id) ?? false,
        restore: (id) => chartRef.current?.restore(id) ?? false,
      }),
      [],
    );

    // Create the chart once. The core is never touched during render.
    useEffect(() => {
      unmounted.current = false;
      if (!containerRef.current) return;
      const chart = new OrbChartCore(containerRef.current, {
        ...config,
        onOrbClick: (orb, event) => callbacks.current.onOrbClick?.(orb, event),
        onOrbHover: (orb) => callbacks.current.onOrbHover?.(orb),
        onDataIssue: (issues) => callbacks.current.onDataIssue?.(issues),
        onOrbPop: (orb) => callbacks.current.onOrbPop?.(orb),
        onOrbRestore: (orb) => callbacks.current.onOrbRestore?.(orb),
        formatValue: (value, orb) => {
          const latest: unknown = callbacks.current.formatValue;
          if (typeof latest === "function") return latest(value, orb);
          if (latest !== undefined && !warnedFormat.current) {
            warnedFormat.current = true;
            console.warn(
              "OrbFlow: formatValue must be a function, using the plain number.",
            );
          }
          return String(value);
        },
      });
      chartRef.current = chart;
      appliedConfig.current = config;
      appliedData.current = data;
      chart.setData(data);
      chart.start();
      if (pendingPause.current) chart.pause();

      return () => {
        unmounted.current = true;
        chart.destroy();
        chartRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
    }, []);

    // Send only the config values that changed.
    useEffect(() => {
      if (!chartRef.current) return;
      const { changes, applied } = diffConfig(appliedConfig.current, config);
      appliedConfig.current = applied;
      if (Object.keys(changes).length > 0)
        chartRef.current.updateConfig(changes);
    });

    // Send data only when its reference changed.
    useEffect(() => {
      if (!chartRef.current || data === appliedData.current) return;
      appliedData.current = data;
      chartRef.current.setData(data);
    }, [data]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ width: "100%", height: "100%", ...style }}
      />
    );
  },
);
