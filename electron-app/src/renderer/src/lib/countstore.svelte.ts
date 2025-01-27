// https://svelte.dev/docs/svelte/$state#Deep-state

// Different Ways To Share State In Svelte 5
// https://www.youtube.com/watch?v=qI31XOrBuY0

export let count = $state({
  value: 0,
  increment() {
    this.value += 1
  },
  decrement() {
    this.value -= 1
  }
})

export function createBoxedCounter(v: number = 0) {
  let count: number = $state(v)
  let isEven: boolean = $derived(count % 2 === 0)

  return {
    get value() {
      return count
    },
    set value(v) {
      count = v
    },
    increment() {
      count += 1
    },
    decrement() {
      count -= 1
    },
    get isEven() {
      return isEven
    }
  }
}

export const boxedCounterGlobal = createBoxedCounter()

export function useCounter(initialValue: number = 0) {
  let count: number = $state(initialValue)

  function read(): number {
    return count
  }

  function write(v: number): void {
    count = v
  }
  return [read, write] as const
}

export function createWrappedCounter(v: number = 0) {
  let count: { value: number } = $state({ value: v })
  let isEven: boolean = $derived(count.value % 2 === 0)

  $effect.root(() => {
    $effect(() => {
      console.log('counter: ', count.value)
    })
  })

  return {
    // works for object destructing ... { count } = obj ... count.value fully reactive
    count,
    increment() {
      count.value += 1
    },
    decrement() {
      count.value -= 1
    },
    // NOTE: this won't work on destructuring -  { isEven } = obj ... // const at time of creating, no reactive.
    get isEven() {
      return isEven
    }
  }
}

export const wrappedCounterGlobal = createWrappedCounter()

// https://svelte.dev/docs/svelte/$state#Classes
export class Counter {
  count = $state(0)

  constructor(v) {
    this.count = v
  }

  // implicit get set for inst.count

  // this binding with arrow function
  increment = () => {
    this.count += 1
  }

  isEven = () => {
    this.count % 2 === 0
  }
}

// https://svelte.dev/docs/svelte/$state#$state.snapshot
