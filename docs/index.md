---
layout: home

hero:
  name: Futurable
  text: JavaScript's Promise and Fetch APIs
  tagline: Supercharged with cancellation, delays, polling and more! 🚀
  image:
    src: /Futurable.png
    alt: Futurable
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/nDriaDev/futurable

features:
  - icon: 🎯
    title: Promise Compatible
    details: Works as a drop-in replacement for native Promises with full compatibility
  - icon: ❌
    title: Cancellable
    details: Cancel any async operation with ease - no more memory leaks or unhandled requests
  - icon: ⏱️
    title: Delays & Sleep
    details: Built-in delay and sleep functionality without complex setTimeout logic
  - icon: 🔄
    title: Polling Support
    details: Native polling mechanism with automatic interval management and cancellation
  - icon: 🌐
    title: Fetch Integration
    details: Enhanced fetch API with automatic AbortController integration
  - icon: 📘
    title: TypeScript First
    details: Full type safety with excellent IDE support and autocompletion
  - icon: 🪶
    title: Zero Dependencies
    details: Lightweight and fast with no external dependencies
  - icon: 🧪
    title: 100% Tested
    details: Battle-tested with complete test coverage and real-world validation
---

## Quick Example

```typescript
import { Futurable } from '@ndriadev/futurable';

// Create a cancellable fetch request
const request = Futurable.fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data));

// Cancel it anytime
request.cancel();
```

## Why Futurable?

JavaScript's native Promise API is powerful but lacks crucial features for modern applications:

- ❌ No way to cancel pending promises
- ❌ No built-in delay or sleep functionality
- ❌ Fetch API requires complex AbortController setup
- ❌ No polling mechanism out of the box

**Futurable solves all of these problems** with a clean, intuitive API that feels natural to use.

## Browser & Node.js Support

- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Node.js 14+ (Native Fetch API support in Node.js 17.5+)
- ✅ TypeScript 4.5+
- ✅ Works with React, Vue, Angular, and vanilla JavaScript

## Installation

::: code-group

```bash [npm]
npm install @ndriadev/futurable
```

```bash [yarn]
yarn add @ndriadev/futurable
```

```bash [pnpm]
pnpm add @ndriadev/futurable
```

:::

## License

[MIT](https://github.com/nDriaDev/futurable/blob/main/LICENSE) © [nDriaDev](https://github.com/nDriaDev)
