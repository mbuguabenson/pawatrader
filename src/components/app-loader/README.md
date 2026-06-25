# App Loader Component

A beautiful, customizable loading screen that displays for a specified duration before your app loads.

## Features

- ✨ Smooth animations and transitions
- 🎨 Beautiful gradient background with floating particles
- 📊 Progress bar with percentage display
- 🎯 Customizable duration
- 📱 Mobile responsive
- 🎭 Theme-aware styling
- ⚡ Lightweight and performant

## Usage

### Method 1: Using AppLoaderWrapper (Recommended)

```tsx
import AppLoaderWrapper from '@/components/app-loader/app-loader-wrapper';

function App() {
    return (
        <AppLoaderWrapper
            duration={5000} // 5 seconds
            enabled={true} // Show loader
        >
            <YourMainApp />
        </AppLoaderWrapper>
    );
}
```

### Method 2: Using AppLoader directly

```tsx
import AppLoader from '@/components/app-loader';
import { useState } from 'react';

function App() {
    const [isLoading, setIsLoading] = useState(true);

    const handleLoadingComplete = () => {
        setIsLoading(false);
    };

    return (
        <>
            {isLoading && <AppLoader onLoadingComplete={handleLoadingComplete} duration={5000} />}
            {!isLoading && <YourMainApp />}
        </>
    );
}
```

### Method 3: Conditional Loading (Development vs Production)

```tsx
import AppLoaderWrapper from '@/components/app-loader/app-loader-wrapper';

function App() {
    const showLoader = process.env.NODE_ENV === 'production';

    return (
        <AppLoaderWrapper
            duration={5000}
            enabled={showLoader} // Only show in production
        >
            <YourMainApp />
        </AppLoaderWrapper>
    );
}
```

## Props

### AppLoaderWrapper Props

| Prop       | Type              | Default | Description                      |
| ---------- | ----------------- | ------- | -------------------------------- |
| `children` | `React.ReactNode` | -       | Your main app content            |
| `duration` | `number`          | `5000`  | Loading duration in milliseconds |
| `enabled`  | `boolean`         | `true`  | Whether to show the loader       |

### AppLoader Props

| Prop                | Type         | Default | Description                       |
| ------------------- | ------------ | ------- | --------------------------------- |
| `onLoadingComplete` | `() => void` | -       | Callback when loading is complete |
| `duration`          | `number`     | `5000`  | Loading duration in milliseconds  |

## Customization

### Changing the Logo/Brand

Edit `src/components/app-loader/app-loader.tsx`:

```tsx
// Replace the SVG icon
<svg width="60" height="60" viewBox="0 0 60 60" fill="none">
    {/* Your custom icon */}
</svg>

// Update the title and subtitle
<h1 className="app-loader__title">Your App Name</h1>
<p className="app-loader__subtitle">Your Tagline</p>
```

### Changing Colors

Edit `src/components/app-loader/app-loader.scss`:

```scss
.app-loader {
    // Change background gradient
    background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 50%, #your-color-3 100%);
}

.app-loader__progress-fill {
    // Change progress bar color
    background: linear-gradient(90deg, #your-primary-color, #your-secondary-color);
}
```

### Different Durations for Different Environments

```tsx
const getDuration = () => {
    if (process.env.NODE_ENV === 'development') return 2000; // 2 seconds in dev
    if (process.env.NODE_ENV === 'production') return 5000; // 5 seconds in prod
    return 3000; // 3 seconds default
};

<AppLoaderWrapper duration={getDuration()} enabled={true}>
    <YourMainApp />
</AppLoaderWrapper>;
```

## Integration Examples

### With React Router

```tsx
import { BrowserRouter } from 'react-router-dom';
import AppLoaderWrapper from '@/components/app-loader/app-loader-wrapper';

function App() {
    return (
        <AppLoaderWrapper duration={5000}>
            <BrowserRouter>
                <Routes>
                    <Route path='/' element={<Home />} />
                    {/* Other routes */}
                </Routes>
            </BrowserRouter>
        </AppLoaderWrapper>
    );
}
```

### With State Management

```tsx
import { Provider } from 'react-redux';
import AppLoaderWrapper from '@/components/app-loader/app-loader-wrapper';

function App() {
    return (
        <AppLoaderWrapper duration={5000}>
            <Provider store={store}>
                <YourMainApp />
            </Provider>
        </AppLoaderWrapper>
    );
}
```

## Performance Notes

- The loader uses CSS animations for smooth performance
- Particles are lightweight and don't impact performance
- Component unmounts completely after loading is finished
- No memory leaks or lingering timers

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Supports all screen sizes and orientations
