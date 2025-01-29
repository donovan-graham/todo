<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    Counter,
    count,
    boxedCounterGlobal,
    createBoxedCounter,
    useCounter,
    wrappedCounterGlobal,
    createWrappedCounter
  } from '../lib/countstore.svelte.js'

  const klassCounter = new Counter(7)

  let boxedCounterLocal = createBoxedCounter(10)

  const [getCount, setCount] = useCounter(5)

  // you can use destructuring, as the count is a wrapped reactive object.
  const {
    count: wrappedCountGlobal,
    increment: wrappedCountGlobalIncremenet,
    isEven: wrappedCounterGlobalEven
  } = wrappedCounterGlobal

  const {
    count: wrappedCountLocal,
    increment: wrappedCountLocalIncremenet,
    isEven: wrappedCounterLocalEven
  } = createWrappedCounter(99)

  $effect(() => {
    console.log('>> effect component mount')

    // NOTE.  if we reference a `reactive` value, then this will re-run every time the reactive value changes
    //          then it will behave similar to useEffect(() => {}, [reactiveValu])
    return () => console.log('>>effect component unmount')
  })

  onMount(() => {
    // set up connection
    // join room
    console.log('>> onMount')
  })

  onDestroy(() => {
    console.log('>> onDestroy')
    // leave room
    // teardown socket

    // store.set('value', Math.floor(Math.random() * 100) + 1)

    // store.reset()
    // count.value = 0
  })

  // let count: number = $state(0)
  let isEven: boolean = $derived(count.value % 2 === 0)
</script>

<div>
  <h3>Option 0: klassCounter</h3>
  <button onclick={() => klassCounter.increment()}>
    count is {klassCounter.count} &&
    <span
      >{#if klassCounter.isEven}even{:else}odd{/if}</span
    >
  </button>
</div>
<!-- --->
<div>
  <h3>Option 1: count</h3>
  <button onclick={() => count.increment()}>
    count is {count.value} &&
    <span
      >{#if isEven}even{:else}odd{/if}</span
    >
  </button>
</div>
<!-- --->
<div>
  <h3>Option 2: boxedCounterGlobal</h3>
  <button onclick={() => boxedCounterGlobal.increment()}>
    count is {boxedCounterGlobal.value} &&
    <span
      >{#if boxedCounterGlobal.isEven}even{:else}odd{/if}</span
    >
  </button>
</div>
<div>
  <h3>Option 3: createBoxedCounter</h3>
  <button onclick={() => boxedCounterLocal.increment()}>
    count is {boxedCounterLocal.value} &&
    <span
      >{#if boxedCounterLocal.isEven}even{:else}odd{/if}</span
    >
  </button>
</div>
<!-- --->
<div>
  <h3>Option 4: wrappedCounterGlobal</h3>
  <button onclick={() => wrappedCountGlobalIncremenet()}>
    count is {wrappedCountGlobal.value} &&
    <span
      >{#if wrappedCounterGlobalEven}even{:else}odd{/if}</span
    >
  </button>
</div>
<div>
  <h3>Option 4: wrappedCounterLocal</h3>
  <button onclick={() => wrappedCountLocalIncremenet()}>
    count is {wrappedCountLocal.value} &&
    <span
      >{#if wrappedCounterLocalEven}even{:else}odd{/if}</span
    >
  </button>
</div>
<!-- --->
<div>
  <h3>Option 4: useCounter</h3>
  <button onclick={() => setCount(getCount() + 1)}>
    count is {getCount()} &&
    <span
      >{#if getCount() % 2 === 0}even{:else}odd{/if}</span
    >
  </button>
</div>
