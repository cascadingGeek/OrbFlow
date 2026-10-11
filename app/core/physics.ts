import { Orb, PhysicsConfig } from "../types/types";

/**
 * Spatial Grid for optimized collision detection
 */
class SpatialGrid {
  private grid: Map<string, Orb[]> = new Map();
  private cellSize: number;

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  clear() {
    this.grid.clear();
  }

  insert(orb: Orb) {
    const cellX = Math.floor(orb.x / this.cellSize);
    const cellY = Math.floor(orb.y / this.cellSize);
    const key = `${cellX},${cellY}`;

    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(orb);
  }

  getNearby(orb: Orb): Orb[] {
    const cellX = Math.floor(orb.x / this.cellSize);
    const cellY = Math.floor(orb.y / this.cellSize);
    const nearby: Orb[] = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        const cell = this.grid.get(key);
        if (cell) nearby.push(...cell);
      }
    }

    return nearby.filter((b) => b.id !== orb.id);
  }
}

/**
 * Core physics engine for orb simulation with bubble physics
 */
export class PhysicsEngine {
  private spatialGrid: SpatialGrid;
  private width: number;
  private height: number;
  private damping: number;
  private minVelocity: number;
  private bounceCoefficient: number;

  constructor(width: number, height: number, config: PhysicsConfig = {}) {
    this.width = width;
    this.height = height;
    this.spatialGrid = new SpatialGrid();

    // Updated for bubble feel
    this.damping = config.damping ?? 0.95; // More friction for bubble feel
    this.minVelocity = config.minVelocity ?? 0.01;
    this.bounceCoefficient = config.bounceCoefficient ?? 0.6; // Softer bounces
  }

  updateDimensions(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  update(orbs: Orb[]): Orb[] {
    this.spatialGrid.clear();

    orbs.forEach((orb) => this.spatialGrid.insert(orb));
    orbs.forEach((orb) => {
      this.updatePosition(orb);
      this.handleBoundaries(orb);
    });

    orbs.forEach((orb) => {
      const nearby = this.spatialGrid.getNearby(orb);
      nearby.forEach((other) => {
        this.handleCollision(orb, other);
      });
    });

    return orbs;
  }

  private updatePosition(orb: Orb) {
    // Add subtle organic movement (brownian motion)
    orb.vx += (Math.random() - 0.5) * 0.02;
    orb.vy += (Math.random() - 0.5) * 0.02;

    orb.x += orb.vx;
    orb.y += orb.vy;

    if (Math.abs(orb.vx) > this.minVelocity) {
      orb.vx *= this.damping;
    }

    if (Math.abs(orb.vy) > this.minVelocity) {
      orb.vy *= this.damping;
    }

    // Cap max velocity to prevent chaotic bubbles
    const maxSpeed = 2;
    const speed = Math.sqrt(orb.vx ** 2 + orb.vy ** 2);
    if (speed > maxSpeed) {
      orb.vx = (orb.vx / speed) * maxSpeed;
      orb.vy = (orb.vy / speed) * maxSpeed;
    }
  }

  private handleBoundaries(orb: Orb) {
    const margin = orb.radius;

    if (orb.x < margin) {
      orb.x = margin;
      orb.vx = Math.abs(orb.vx) * this.bounceCoefficient + 0.5; // Add push off wall
    } else if (orb.x > this.width - margin) {
      orb.x = this.width - margin;
      orb.vx = -Math.abs(orb.vx) * this.bounceCoefficient - 0.5;
    }

    if (orb.y < margin) {
      orb.y = margin;
      orb.vy = Math.abs(orb.vy) * this.bounceCoefficient + 0.5;
    } else if (orb.y > this.height - margin) {
      orb.y = this.height - margin;
      orb.vy = -Math.abs(orb.vy) * this.bounceCoefficient - 0.5;
    }
  }

  private handleCollision(a: Orb, b: Orb) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = a.radius + b.radius;

    if (distance < minDistance && distance > 0) {
      // Separate the orbs
      const overlap = (minDistance - distance) * 0.5;
      const separationX = (dx / distance) * overlap;
      const separationY = (dy / distance) * overlap;

      a.x -= separationX;
      a.y -= separationY;
      b.x += separationX;
      b.y += separationY;

      // Apply subtle bounce - just push them apart gently
      const pushStrength = 0.3; // Reduced from full collision response
      a.vx -= (dx / distance) * pushStrength;
      a.vy -= (dy / distance) * pushStrength;
      b.vx += (dx / distance) * pushStrength;
      b.vy += (dy / distance) * pushStrength;
    }
  }

  // New method for mouse interaction
  applyMouseRepulsion(mouseX: number, mouseY: number, radius: number = 150) {
    this.orbs.forEach((orb) => {
      const dx = orb.x - mouseX;
      const dy = orb.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < radius && distance > 0) {
        const force = (1 - distance / radius) * 2; // Stronger when closer
        orb.vx += (dx / distance) * force;
        orb.vy += (dy / distance) * force;
      }
    });
  }

  get orbsArray(): Orb[] {
    return this.orbs;
  }

  set orbsArray(orbs: Orb[]) {
    this.orbs = orbs;
  }

  private orbs: Orb[] = [];
}
