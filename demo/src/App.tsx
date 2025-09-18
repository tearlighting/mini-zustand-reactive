import { useRef } from "react"
import "./App.css"
import { useCounter } from "./store"

const useRenderTimes = () => {
  const renderTimesRef = useRef(0)
  renderTimesRef.current++
  return renderTimesRef.current
}
function CountView() {
  const count = useCounter((s) => s.count)
  const renderTimes = useRenderTimes()
  console.log("[render] <CountView>")
  return (
    <div style={{ display: "flex", gap: 20 }}>
      <p>count: {count}</p>
      <p>
        re-render <span>{renderTimes}</span>
      </p>
    </div>
  )
}

function OtherView() {
  const other = useCounter((s) => s.other)
  const renderTimes = useRenderTimes()
  console.log("[render] <OtherView>")
  return (
    <div style={{ display: "flex", gap: 20 }}>
      <p>count: {other}</p>
      <p>
        re-render <span>{renderTimes}</span>
      </p>
    </div>
  )
}

function Buttons() {
  const inc = useCounter((s) => s.inc)
  const incOther = useCounter((s) => s.incOther)
  console.log("[render] <Buttons>")
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={inc}>+1 count</button>
      <button onClick={incOther}>+1 other</button>
    </div>
  )
}

export default function App() {
  return (
    <div style={{ fontFamily: "ui-sans-serif", padding: 16 }}>
      <h1>mini-zustand-reactive demo</h1>
      <Buttons />
      <CountView />
      <OtherView />
    </div>
  )
}
