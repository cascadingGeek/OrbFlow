import { useEffect, useRef } from "react";
import type { CSSProperties, FC } from "react";
import { OrbChart as OrbChartCore } from "../core/OrbChart";
import type { OrbChartConfig, OrbDataInput } from "../types/types";

export interface OrbChartProps extends OrbChartConfig {
  data: OrbDataInput[];
  className?: string;
  style?: CSSProperties;
}

/**
 * React component wrapper for OrbChart
 */
export const OrbChart: FC<OrbChartProps> = ({
  data,
  className,
  style,
  ...config
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<OrbChartCore | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize chart
    chartRef.current = new OrbChartCore(containerRef.current, config);
    chartRef.current.setData(data);
    chartRef.current.start();

    // Cleanup
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update data when it changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setData(data);
    }
  }, [data]);

  // Update config when it changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.updateConfig(config);
    }
  }, [config]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
};
