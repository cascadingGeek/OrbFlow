import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import { OrbChart as OrbChartCore } from "../core/OrbChart";
import type { Orb, OrbChartConfig, OrbDataInput } from "../types/types";
import { diffConfig, type ConfigValues } from "./diffConfig";
import { useLatest } from "./useLatest";

/**
 * Props of the `<OrbChart>` component: every chart option, plus the data and
 * the usual `className` and `style` of the container.
 *
 * - `data` is applied with `setData` whenever its reference changes. Keep it
 *   stable (for example with `useMemo`) to avoid needless updates.
 * - Callbacks (`onOrbClick`, `onOrbHover`, `onDataIssue`) can change on every
 *   render. The newest one always runs, and a change causes no chart update.
 * - Config values are compared by value, and `colorScheme` item by item, so
 *   inline objects and arrays with equal values cost nothing.
 * - A config prop that becomes `undefined` (or is removed) keeps its last
 *   value. It is not reset to the default. Pass an explicit value to change it.
 * - `damping`, `minVelocity`, and `bounceCoefficient` only take effect at
 *   mount. `width` and `height` are replaced by the measured container size.
 */
export interface OrbChartProps extends OrbChartConfig {
  /** Orbs to draw. Matched by `id` on every change of this reference. */
  data: OrbDataInput[];
  /** Class name of the container `div`. */
  className?: string;
  /**
   * Style of the container `div`. It fills its parent by default
   * (`width: 100%; height: 100%`), and anything given here overrides that.
   */
  style?: CSSProperties;
}

/**
 * What a ref to `<OrbChart>` gives you. The object stays the same across
 * renders. It does nothing after the component unmounts.
 */
export interface OrbChartHandle {
  /** Starts or resumes the animation. */
  start(): void;
  /**
   * Pauses the animation. A paused chart stays paused when new data or config
   * arrives, and shows it as one still frame. Calling this before the chart
   * exists (for example in a parent's layout effect) makes it start paused.
   */
  pause(): void;
  /**
   * The chart's current orbs, without orbs that are shrinking out. Returns
   * `[]` when the chart is not mounted. These are the live objects: treat them
   * as read only.
   */
  getData(): Orb[];
}

/**
 * React component for an OrbFlow chart. It renders one `div` on the server and
 * creates the canvas after mount, so it is safe with server rendering, strict
 * mode, and error boundaries. A failure while creating the chart is thrown to
 * the nearest error boundary. Use `ref` to get an {@link OrbChartHandle}.
 *
 * Add `"use client"` to the file that renders it in a server components setup.
 */
export const OrbChart = forwardRef<OrbChartHandle, OrbChartProps>(
  function OrbChart({ data, className, style, ...rest }, ref) {
    const { onOrbClick, onOrbHover, onDataIssue, ...config } = rest;
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<OrbChartCore | null>(null);
    const unmounted = useRef(false);
    const pendingPause = useRef(false);
    const appliedConfig = useRef<ConfigValues>(config);
    const appliedData = useRef(data);
    const callbacks = useLatest({ onOrbClick, onOrbHover, onDataIssue });

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
