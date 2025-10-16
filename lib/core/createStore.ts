import { ref, effect } from "@vue/reactivity"
import { useSyncExternalStore,useCallback,useState } from "react"
import type { ISetData, ISubscriberParams } from "miniZustandReactive"

export function createStore<T extends object>(initializer: (setData: ISetData<T>) => T) {
  const state = ref<T>(initializer(setData))
  function setData(callback: (state: T) => void) {
    callback(state.value)
  }
  const getState = () => state.value as T
  const setState = (updater: (state: T) => void) => {
    updater(state.value)
  }

  const subscribe = ({ callback, selector }: ISubscriberParams<T>) => {
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
export function createUseStore<T extends Object>(initializer: (setData: ISetData<T>) => T) {
  const store = createStore(initializer)
  const useStoreFactory = <TReturn>(selector: (s: T) => TReturn) => useStore(store, selector)
  return Object.assign(useStoreFactory, { setState: store.setState.bind(store), getState: store.getState.bind(store) })
}

export function useStore<T extends Object, S>(store: ReturnType<typeof createStore<T>>, selector: (s: T) => S): S {
  const stableSubscriber = useCallback((callback: ()=>void)=>{
    store.subscribe({callback,selector})
  },[])
  const [stableSelector] = useState(()=>{
    return () => selector(store.getState())
  })
  return useSyncExternalStore(
    stableSubscriber,
    stableSelector
  )
}
