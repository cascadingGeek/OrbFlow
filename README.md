# Orb Flow 🫧

A lightweight, physics-based orb chart package with smooth animations and realistic interactions. Zero dependencies for the core library!

## Features

- Beautiful glassy orb design
- Smooth physics-based animations
- Works with vanilla JavaScript and React
- Zero dependencies (core library)
- Responsive and touch-friendly
- Support for images inside orbs
- Customizable colors and styling

## Installation
```bash
npm install orbflow
# or
yarn add orbflow
# or
pnpm add orbflow
```

## Quick Start

### Vanilla JavaScript
```javascript
import OrbChart from 'orbflow';

const chart = new OrbChart('#chart-container', {
  width: 800,
  height: 600,
  onOrbClick: (orb) => console.log('Clicked:', orb)
});

chart.setData([
  { id: '1', label: 'Bitcoin', value: 45, color: '#f7931a' },
  { id: '2', label: 'Ethereum', value: 30, color: '#627eea' },
  { id: '3', label: 'Solana', value: 15, color: '#00d4aa' }
]);

// chart.start() is called automatically if data is set, but can be controlled manually
```

### React
```tsx
import { OrbChart } from 'orbflow/react';

function App() {
  const data = [
    { id: '1', label: 'Bitcoin', value: 45, color: '#f7931a' },
    { id: '2', label: 'Ethereum', value: 30, color: '#627eea' },
  ];

  return (
    <div style={{ width: '800px', height: '600px' }}>
      <OrbChart 
        data={data}
        onOrbClick={(orb) => console.log(orb)}
        enableTooltip={true}
        floatAmplitude={1.5}
      />
    </div>
  );
}
```

## API Reference

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | number | container width | Chart width in pixels |
| `height` | number | container height | Chart height in pixels |
| `minRadius` | number | 20 | Minimum orb radius |
| `maxRadius` | number | 200 | Maximum orb radius |
| `backgroundColor` | string | '#0a0e1a' | Canvas background color |
| `colorScheme` | string[] | [...] | Default color palette |
| `enableTooltip` | boolean | true | Show tooltips on hover |
| `onOrbClick` | function | - | Click event handler |
| `onOrbHover` | function | - | Hover event handler |
| `damping` | number | 0.995 | Physics damping factor |
| `minVelocity` | number | 0.1 | Minimum velocity before stopping |
| `bounceCoefficient` | number | 0.8 | Bounce elasticity (0-1) |
| `floatAmplitude` | number | 1.5 | Idle floating movement range |
| `floatSpeed` | number | 0.001 | Idle floating speed |

### Data Format (`OrbDataInput`)
```typescript
interface OrbDataInput {
  id: string;           // Unique identifier
  label: string;        // Display label
  value: number;        // Size value
  color?: string;       // Orb color (optional)
  imageUrl?: string;    // Image URL (optional)
  metadata?: Record<string, any>; // Custom data (optional)
}
```

## Roadmap

Version 1.0 supports vanilla JavaScript and React. More frameworks arrive one per minor release, with no breaking changes:

- **1.1**: Vue
- **1.2**: Svelte
- **1.3**: Angular

## License

MIT © [cascadingGeek]