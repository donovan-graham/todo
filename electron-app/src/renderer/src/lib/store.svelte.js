const initalValue = {
  value: 0,
  someString: '',
  someList: [],
  someDictionary: {}
}

export const store = $state({
  store: initalValue,

  initialize() {
    //some logic
  },

  set(key, value) {
    this.store[key] = value
  },
  push(key, value) {
    this.store[key].push(value)
  },
  remove(key, value) {
    let index = this.store[key].indexOf(value)

    if (index !== -1) {
      this.store[key].splice(index, 1)
    }
  },
  get(key) {
    return this.store[key]
  },
  reset() {
    this.store = initalValue
  }
})
