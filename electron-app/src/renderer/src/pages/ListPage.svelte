<script lang="ts">
  import { SvelteDate } from 'svelte/reactivity'
  import { Link, useHistory } from 'svelte-routing'
  import { subHours, format, toDate, formatDistance } from 'date-fns'

  import Textarea from '../components/Textarea.svelte'
  import { user } from '../stores/user.svelte'
  import { ListWebSocket } from '../stores/listWebSocket.svelte'

  import type { fromStore } from 'svelte/store'
  import { TODO_STATUS, TODO_STATUS_TRANSITION, TODO_STATUS_COLORS, TODO_POSITION_DIRECTION } from '../utils'
  import {
    ListTodo,
    CirclePlus,
    ArrowBigUp,
    ArrowBigDown,
    ArrowBigLeft,
    ArrowBigRight
  } from 'lucide-svelte'

  const { id } = $props()
  const list = new ListWebSocket()

  const history = useHistory()
  const listName = history?.location?.state?.name || 'Untitled'

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

<h2><ListTodo />List: {listName}</h2>
<hr />

{#if list.isConnected}
<div>Total: {list.count}</div>
<br />
<br />
{#if list.count === 0}
    <p>Make your first todo</p>
  {:else}
    <div class="list">
      {#each list.sortedTodos as todo, index (todo.id)}
        {@const [back, next] = TODO_STATUS_TRANSITION[todo.status]}
        <div class="todo {list.lastTodoId === todo.id ? 'active' : ''}">
          <div class="todo-position">
            <div class="list-index">
              {index + 1}.
            </div>
            {#if index !== 0}
              <button
                class="icon"
                onclick={() => list.moveTodo(todo.id, TODO_POSITION_DIRECTION.Up)}
                ><ArrowBigUp /></button
              >
            {/if}
            {#if index !== list.count - 1}
              <button
                class="icon"
                onclick={() => list.moveTodo(todo.id, TODO_POSITION_DIRECTION.Down)}
                ><ArrowBigDown /></button
              >
            {/if}
          </div>

          <div class="todo-status">
            <div class="action">
              {#if back}
                <button
                  class="icon"
                  onclick={() => list.transitionTodoStatus(todo.id, todo.status, back)}
                  ><ArrowBigLeft /></button
                >
              {/if}
            </div>
            <div style="background-color: {TODO_STATUS_COLORS[todo.status]}; padding: 1rem; border-radius: 0.5rem;">
              {todo.status}
            </div>
            <div class="action">
              {#if next}
                <button
                  class="icon"
                  onclick={() => list.transitionTodoStatus(todo.id, todo.status, next)}
                  ><ArrowBigRight /></button
                >
              {/if}
            </div>
          </div>

          
          <div class="todo-description">
              <Textarea
                value={todo.description}
                handleStart={() => list.lastTodoId = todo.id}
                handleSave={(text: string) => list.updateTodoDescription(todo.id, text)}
              />
          </div>
          <div class="todo-last-updated">
            <span>{todo.id.substring(0, 8)}</span>
            <span>last updated:</span>
            <span>{format(new Date(todo.updated_at), 'dd MMM yy HH:mm:ss')}</span>
            <span>{formatDistance(todo.updated_at, currentDate, { includeSeconds: false })} ago</span>
          </div>
         
        </div>
      {/each}
    </div>
  {/if}

  <br /><br />
  <br />

  <button onclick={() => list.createTodo()}><CirclePlus />Add New</button>
{:else if list.isFetching}
  <p>Loading...</p>
{:else}
  <p>Connecting...</p>
{/if}

<style>
  .todo {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 1rem;
    /* justify-content: space-between; */
    background-color: #3e4553;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem
    
  }
  .todo.active {
    border-color: #ff7361;
  }

  .todo-position {
    /* border: 1px solid red; */
    min-width: 5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .todo-status {
    flex: 0 0 1;
    border-left: 1px solid #596379;
    padding-left: 1rem;
    width: 140px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .action {
    width: 2rem;
  }
  .todo-description {
    border-left: 1px solid #596379;
    padding-left: 1rem;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    justify-items: left;
  }

  /* ss */

  button.icon {
    padding: 0;
    margin: 0;
    background-color: transparent;
    color: #ff7361;
  }
  .list {
    display: flex;
    flex-direction: column;
    align-items: left;
    gap: 1rem;
  }
  .list-index {
    font-size: 1rem;
    color: 818690;
    min-width: 1.6rem;
  }


  .todo-last-updated {
    border-left: 1px solid #596379;
    padding-left: 1rem;

    flex: 0 0 140px;
    font-size: 0.8rem;
    line-height: 1rem;
    color: #818690;
    display: flex;
    flex-direction: column;

  }
</style>
