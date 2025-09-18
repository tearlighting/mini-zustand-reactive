# MINI-ZUSTAND-Reactive

## 🎯 Why this repo?

万事都有理由。这个项目来自我在真实业务里反复踩到的痛点。尤其是 **表单和大列表** 这种对渲染粒度的控制。

我最早是 Vue (Vue2) 出身。当时对响应式原理一知半解：

- Vue2 的 data 是响应式，但 `this` 后注入，感觉很违和。
- 到了 Vue3，有了 `reactive/ref`，我开始强烈想搞明白「为什么数据会响应式变化」。
- 于是写了个最小实现：用 Proxy 去 `track` 和 `trigger`，`effect` 里收集依赖。模板编译成 render 函数后放到 effect 里，一旦数据变了就 re-render。
- 那一刻我才真正体会到：**数据本身与环境无关，放进 effect 里才有意义**。

这也是我后面 templify-form 的雏形，最开始直接用 Vue 的 reactive 来驱动。

## ⚛️ React

既然要深耕前端，React 绕不过去。我上手就是 React 18 的函数式组件时代，class 组件没碰过。

表面上 React 用起来很简单：

```ts
const [count, setCount] = useState(1)
const handleClick = () => setCount(count + 1)
```

但一旦放到工作场景，问题接踵而至：

1.  依赖管理混乱：useEffect 到底依赖谁，useCallback 要不要加？写多了就开始怀疑人生。

```ts
const callback = useCallback(() => {
  //do something
}, [dps])

useEffect(() => {
  callback()
}, [trigger])
```

2.  setState 异步问题：想搞 flag，没戏。

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

3.  全量 re-render：想精细化更新？不好意思，全丢给开发者自己搞。

学习 React 原理以后（我自己手搓了一个 tiny-react），我终于看清了 Fiber、Scheduler、beginWork / bailout / diff、completeWork / commit 的流程。
那种“啊，原来如此”的感觉很爽，但同时也发现：有些优化，React 故意甩给开发者自己做。

## 我的探索

在 Vue 里你可以随便用响应式，而在 React 里，如果你真的想要 OOP 风格的 core + hooks 皮肤，就会很快遇到 re-render 问题。
小 form 还好，全量更新没啥。但大 form 或大列表？直接炸。

于是我开始研究状态库，比如 Zustand。发现他们也就是基于 useSyncExternalStore 做订阅。
关键点在于：

- store 本身包在闭包里，只有一份
- 组件通过 selector 订阅自己关心的片段
- getSnapshot 确保 selector 变了才 re-render

## 🛠️ 我的实现（第一版）

我一开始的想法很简单，publish 通知 react 更新而已，直接来呗。

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

它能跑。但我很快发现问题：

- publish 全量通知 → 所有订阅的组件都会 re-render，然后大部分在 beginWork bailout。

- 虽然比直接全量 re-render 好一丢丢，但 通知没必要的组件本身就不合理。

于是我开始想：是不是要维护 selector → callback 的映射，只有真的变了才通知？

就很有既视感有没有，一个函数(getter),数据变化通知，是不是就是 effect?只是不是执行 getter,而是执行其他函数而已！

这就和响应式系统越来越像了。

## ⚡ 遇到的新问题

1. store 内函数的问题

```ts
// App.tsx
createStore(() => {
  let count = 1
  function add() {
    count++ // 原始数据改了，proxy 感知不到
  }
})
```

必须像 React 一样，把 setData 注入进来，用它改数据。

2.  嵌套数据的问题

```ts
a.b.c.d.count = { value: 1 }
```

selector 如果直接拿到 a，props drilling 下去，内部多少层在用完全不可控。
要么整条链路都换新对象，要么就放弃细粒度。

目前主流库（包括 Zustand）其实也没解决这个问题。

## 🧠 当前状态

所以我的策略是：

- 第一版直接用 Vue 的 reactive core 封装（反正它能自动依赖收集）。

- 不考虑极深嵌套，只做到 selector 级别的精细更新。

- 如果要到生产环境，还是建议直接用成熟库（Zustand、Jotai 之类）。

这个 repo 更像是我的一份「实验记录」。

## 感想

写起来其实很简单，思路也清晰。
但要真的放到生产环境？我肯定不敢，坑太多。

不过这就是我开 repo 的目的：

- 记录我对 React 状态管理的一次探索
- 给自己一个「成长的证明」
- 说不定以后 templify-form 也能直接套用这个思路

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

- 支持更细粒度的依赖追踪（尝试响应式核心）。
- 性能测试：大表单场景能不能 hold 住。
- demo：写几个直观的例子。
- 和 Vue/React 的双端皮肤配合

---

## 📎 License

MIT

## demo

见 demo
