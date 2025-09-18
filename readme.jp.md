# MINI-ZUSTAND-Reactive

## なぜこのリポジトリ?

## ⚛️ React

フロントエンドを深掘りする以上、React は避けられません。  
私は React 18 の関数コンポーネントから始め、class コンポーネントは経験していません。

表面的には React は簡単です：

```ts
const [count, setCount] = useState(1)
const handleClick = () => {
  setCount(count + 1)
}
```

しかし業務で使うと、すぐに問題が出てきます：

1. 依存関係の混乱：useEffect の依存、useCallback を入れるかどうか。

```ts
const callback = useCallback(() => {
  //do something
}, [dps])

useEffect(() => {
  callback()
}, [trigger])
```

2. setState の非同期問題：フラグの扱いがうまくいかない。

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

3. 全量 re-render：細かい制御をしたいなら、全部開発者任せ。

React の仕組みを勉強した後（自分で tiny-react を作った）、Fiber、Scheduler、beginWork / bailout / diff、completeWork / commit の流れを理解できました。
「ああ、そういうことか」と納得しましたが、同時に 最適化をわざと開発者に押し付けている こともわかりました。

## 探索

Vue ではリアクティブを自由に使えます。
しかし React で OOP スタイルの core + hooks を作ろうとすると、すぐに re-render の壁に当たります。

- 小さなフォームなら問題なし。
- 大きなフォームやリストなら爆発。

そこで Zustand などの状態管理ライブラリを調べました。
結局、彼らも useSyncExternalStore をベースにしていると分かりました。

ポイントは：

- store はクロージャに包まれ、一つだけ存在する
- コンポーネントは selector で購読
- getSnapshot が変わった時だけ再レンダリング

## 🛠️ 初期実装

最初の考えは単純で「publish して React に更新を通知すればいい」と思っていました。

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

これは動きました。しかし気づいたのは：

- publish が全サブスクライバに通知 → 全コンポーネントが再レンダリングし、多くは beginWork で bailout。
- 素の全量更新よりはマシですが、不要なコンポーネントに通知するのは根本的におかしい。

そこで「selector → callback」の対応を持って、本当に変わったときだけ通知すべきでは？と思いました。
これはまさに effect と同じ感覚でした。

## ⚡ 新たな課題

1. store 内の関数

```ts
// App.tsx
createStore(() => {
  let count = 1
  function add() {
    count++ // proxyじゃないと検知できない
  }
})
```

解決策：React のように setData を注入する。

2.  ネストされたデータ

```ts
a.b.c.d.count = { value: 1 }
```

selector が a を取る場合、props drilling で内部の利用が制御不能になります。
チェーン全体を新しいオブジェクトに置き換えるか、細粒度を諦めるか。

実際、Zustand などの主流ライブラリも解決できていません。

## 🧠 現在の状況

現時点での方針：

- 第一版は Vue の reactivity core をラップして依存収集を任せる
- 深いネストは扱わない
- selector レベルの精度を重視

このリポジトリは基本的に 実験ログ です。

## 感想

書くのは簡単で楽しい。
でもプロダクションで使う？それは無理。リスクが大きすぎる。

それでもこのリポジトリを作った理由は：

- React 状態管理の探索を記録するため
- 自分の成長の証として残すため
- いつか templify-form に応用できるかもしれない

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

## 🔮 TODO / 今後

- さらに細かい依存追跡（reactivity core を活用）
- 大規模フォームでのパフォーマンステスト
- デモ例を追加
- Vue/React 両方のスキンに対応

---

## 📎 License

MIT

## demo

demo
