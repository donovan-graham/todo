<script lang="ts">
  import { SvelteDate } from 'svelte/reactivity'
  import { Link } from 'svelte-routing'
  import { subHours, format, toDate, formatDistance } from 'date-fns'

  import Textarea from '../components/Textarea.svelte'
  import { user } from '../stores/user.svelte'
  import { ListWebSocket } from '../stores/listWebSocket.svelte'

  import type { fromStore } from 'svelte/store'
  import { TODO_STATUS, TODO_STATUS_TRANSITION, TODO_POSITION_DIRECTION } from '../utils'

  const { id } = $props()
  const list = new ListWebSocket()

  // TODO: we're getting daylight saving time offset here. Need to fix timezone differnces at DB
  let currentDate = $state(subHours(Date.now(), 1))

  $effect(() => {
    list.connect(user.authToken, id)
    return () => {
      list.disconnect()
    }
  })

  const handleSubmit = (payload) => {
    debugger
    // list.createTodo(payload)
  } 

  $effect(() => {
    const interval = setInterval(() => {
      // TODO: we're getting daylight saving time offset here. Need to fix timezone differnces at DB.
      currentDate = subHours(Date.now(), 1)
    }, 1000) 

    return () => {
      clearInterval(interval)
    }
  })
</script>

&laquo; <Link to="/lists">back to lists</Link>
<h1>List: {id} {name}</h1>

<!-- <p>The time is {currentDate.getHours()}:{currentDate.getMinutes()}:{currentDate.getSeconds()}</p> -->

{#if list.isConnected}
  {#if list.count === 0}
    <p>Make your first todo</p>
  {:else}
    <div>Total: {list.count}</div>
    {#each list.sortedTodos as todo, index (todo.id)}
      {@const [back, next] = TODO_STATUS_TRANSITION[todo.status]}
      <div class="todo {list.lastTodoId === todo.id ? 'active' : ''}">
        <div class="todo-position">
          <div>
            {index + 1}. {todo.position}
          </div>
          <div class="action">
            {#if index !== 0}
              <button onclick={() => list.moveTodo(todo.id, TODO_POSITION_DIRECTION.Up)}
                >&UpArrow;</button
              >
            {/if}
          </div>
          <div class="action">
            {#if index !== list.count - 1}
              <button onclick={() => list.moveTodo(todo.id, TODO_POSITION_DIRECTION.Down)}
                >&DownArrow;</button
              >
            {/if}
          </div>
        </div>
        <div>
          {todo.id.substring(0, 5)}
        </div>
        <div class="todo-description">
          <div><Textarea value={todo.description} handleSave={(text: string) => list.updateTodoDescription(todo.id, text)} /></div>
          <div>{formatDistance(todo.updated_at, currentDate, { includeSeconds: true })}</div>
        </div>
        <div class="todo-status">
          <div class="action">
            {#if back}
              <button onclick={() => list.transitionTodoStatus(todo.id, todo.status, back)}
                >&laquo;</button
              >
            {/if}
          </div>
          <div>
            {todo.status}
          </div>
          <div class="action">
            {#if next}
              <button onclick={() => list.transitionTodoStatus(todo.id, todo.status, next)}
                >&raquo;</button
              >
            {/if}
          </div>
        </div>
      </div>
    {/each}
  {/if}

  <button onclick={() => list.createTodo()}>Create Todo</button>
{:else if list.isFetching}
  <p>Loading...</p>
{:else}
  <p>Connecting...</p>
{/if}

<style>
  .todo {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 10px;
    border: 1px solid #ccc;
    margin: 5px;
  }
  .todo.active {
    border-color: purple;
  }

  .todo-position {
    border: 1px solid red;
    width: 180px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .todo-status {
    border: 1px solid red;
    width: 200px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .action {
    width: 60px;
  }
  .todo-description {
    display: flex;
    flex-direction: column;
    justify-items: left;
  }
</style>
