import { createUseStore, type ISetData } from "mini-zustand-reactive"

interface ICounterStore {
  count: number
  other: number
  inc: () => void
  incOther: () => void
}

export const useCounter = createUseStore<ICounterStore>((setData: ISetData<ICounterStore>) => {
  let count = 0
  let other = 0
  function inc() {
    setData((store) => {
      store.count++
    })
  }
  function incOther() {
    setData((store) => {
      store.other++
    })
  }
  return {
    count,
    other,
    inc,
    incOther,
  }
})
