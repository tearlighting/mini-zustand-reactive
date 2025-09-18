# MINI-ZUSTAND-Reactive

## 🎯 Why this repo?

Everything has a reason.  
This project comes from the pain I repeatedly faced in real-world business scenarios — especially **forms and large lists**, where controlling rendering granularity really matters.

I started out with Vue (Vue2). At that time, I only had a vague understanding of reactivity:

- In Vue2, `data` is reactive, but `this` gets injected later, which feels counterintuitive.
- In Vue3, with `reactive/ref`, I wanted to understand _why_ data becomes reactive.
- So I wrote a minimal implementation: using Proxy for `track` and `trigger`, collecting dependencies in `effect`.  
  Once data changes, the render function re-runs.
- That was the moment I realized: **data itself is environment-agnostic — only when placed inside an effect does it have meaning.**

This was also the prototype for my later project **templify-form**, originally driven directly by Vue's reactive.

## ⚛️ React

Since I want to go deep into frontend, React was unavoidable.  
I started with React 18 functional components (never touched classes).

On the surface, React looks simple:

```ts
const [count, setCount] = useState(1)
const handleClick = () => setCount(count + 1)
```

But in real work scenarios, problems appear quickly:

1.  Dependency confusion: useEffect dependencies, whether to add useCallback, etc.

```ts
const callback = useCallback(() => {
  //do something
}, [dps])

useEffect(() => {
  callback()
}, [trigger])
```

2.  setState async issues: flags don’t work as expected.

```ts
const multiFlag = useRef(false)
const [count, setCount] = useState(1)
const handleClick = (mode: "multi" | "plus") => {
  if (mode === "multi") {
    multi.current = true
    setCount(count * 2)
    multi.current = false
  } else {
    setCount(count + 1)
  }
}

useEffect(() => {
  if (multi.current) {
    //do some things
  }
}, [count])
```

3.  Full re-render: Fine-grained control? Sorry, you do it yourself.

After studying React internals (I even wrote a tiny-react), I finally understood Fiber, the Scheduler, beginWork / bailout / diff, completeWork / commit.
That “aha!” moment was great, but I also realized: React intentionally pushes optimization responsibility back to developers.

## My Exploration

In Vue, you can just use reactive data anywhere.
But in React, if you want an OOP-style core with hooks on top, you quickly hit re-render problems.

- Small forms? Fine.
- Big forms or lists? Explodes.

So I looked into state libraries like Zustand. Turns out they also use useSyncExternalStore.

The key points:

- Store lives in a closure — only one instance
- Components subscribe via selectors.
- getSnapshot ensures only selector changes trigger re-render.

## 🛠️ My First Implementation

At first I thought: just publish and notify React to update.

```ts
export function createStore<T extends Object>(initializer: (update: () => void) => T) {
  const blocker = new Blocker()
  const publisher = new Publisher(blocker)
  const subscriber = new Subscriber(blocker)

  const update = () => {
    publisher.publish("updateStore")
  }

  let state = initializer(update)

  const getState = () => state
  const setState = (partial: Partial<T>) => {
    state = { ...state, ...partial }
    update()
  }

  const subscribe = (listener: () => void) => {
    return subscriber.subscribe("updateStore", listener)
  }

  return { subscribe, getState, setState }
}

export function useStore<T extends Object, S>(store: ReturnType<typeof createStore<T>>, selector: (s: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}

export function createUseStore<T extends Object>(initializer: (update: () => void) => T) {
  const store = createStore(initializer)
  const useStoreFactory = <TReturn>(selector: (s: T) => TReturn) => useStore(store, selector)
  return Object.assign(useStoreFactory, {
    setState: store.setState.bind(store),
    getState: store.getState.bind(store),
  })
}
```

It worked — but I noticed：

- publish notifies ALL subscribers → all components re-render, then most bail out in beginWork
- Better than naive full re-render, but notifying unnecessary components is fundamentally wrong.

So I wondered: why not map selector → callback, and notify only when it actually changes?

That felt exactly like an effect.

This started to look more and more like a reactive system.

就很有既视感有没有，一个函数(getter),数据变化通知，是不是就是 effect?只是不是执行 getter,而是执行其他函数而已！

这就和响应式系统越来越像了。

## ⚡ New Issues

1. Functions inside store

```ts
createStore(() => {
  let count = 1
  function add() {
    count++ // // proxy cannot detect
  }
})
```

Solution: inject setData, like React’s setState.

2.  Nested data

```ts
a.b.c.d.count = { value: 1 }
```

If a selector grabs a, and you drill props down, internal usage is uncontrollable.
Either replace the whole chain with new objects, or give up on fine granularity.

Even libraries like Zustand don’t really solve this.

## 🧠 Current Status

My current approach：

- First version: just wrap with Vue’s reactivity core (easy auto dependency tracking).
- Don’t handle deep nested updates.
- Focus on selector-level granularity.

This repo is mostly an experiment log.

## Thoughts

It’s simple and fun to write.
But for production? Definitely risky — too many pitfalls.

That’s why I opened this repo:

- To record my exploration of React state management
- To keep a proof of my growth.
- Maybe someday templify-form can adopt this approach.

```ts
export function createStore<T extends object>(initializer: (setData: ISetData<T>) => T) {
  const state = ref<T>(initializer(setData))
  function setData(callback: (state: T) => void) {
    callback(state.value)
  }
  const getState = () => state.value as T
  const setState = (partial: Partial<T>) => {
    state.value = { ...state.value, ...partial }
  }

  const subscribe = ({ callback, selector }: ISubscriberParams<T>) => {
    //不就是直接收集依赖并触发吗
    const runner = effect(() => {
      selector(state.value)
      callback()
    })
    return runner.effect.stop.bind(runner)
  }

  return {
    getState,
    setState,
    subscribe,
  }
}
```

## 🔮 TODO / 未来方向

- Support more fine-grained dependency tracking
- Performance tests for large forms.
- Demo examples.
- Dual-skin integration for Vue/React.

---

## 📎 License

MIT

## demo

demo
