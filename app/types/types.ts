/**
 * Common types for OrbFlow
 */

export interface Orb {
  id: string;
  label: string;
  value: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export interface PhysicsConfig {
  damping?: number;
  minVelocity?: number;
  bounceCoefficient?: number;
  floatAmplitude?: number;
  floatSpeed?: number;
}

export interface OrbChartConfig extends PhysicsConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
  minRadius?: number;
  maxRadius?: number;
  colorScheme?: string[];
  enableTooltip?: boolean;
  onOrbClick?: (orb: Orb, event: MouseEvent) => void;
  onOrbHover?: (orb: Orb | null) => void;
}

export interface OrbDataInput {
  id: string;
  label: string;
  value: number;
  color?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}
