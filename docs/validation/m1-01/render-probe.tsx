import { createStore } from "solid-js/store"
import { onCleanup } from "solid-js"

export function RenderProbe(props: { cleanup: () => void }) {
  const [store, setStore] = createStore({ draft: "draft", clicks: 0 })
  onCleanup(props.cleanup)
  return (
    <section>
      <textarea value={store.draft} onInput={(event) => setStore("draft", event.currentTarget.value)} />
      <button onClick={() => setStore("clicks", store.clicks + 1)}>{store.clicks}</button>
      <output>{store.draft}</output>
    </section>
  )
}
