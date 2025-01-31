<script lang="ts">
  import { Link } from 'svelte-routing'
  import { user } from '../stores/user.svelte'
  import CreateListForm from '../components/CreateListForm.svelte'
  import JoinListForm from '../components/JoinListForm.svelte'

  import { List, ListRestart, Copy } from 'lucide-svelte'

  enum LoadState {
    Idle,
    Loading,
    Success,
    Error
  }
  let lists = $state()
  let loadState = $state(LoadState.Loading)

  const load = async () => {
    loadState = LoadState.Loading
    const url = 'http://localhost:3000/api/v1/lists'
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.authToken}`
        },
        mode: 'cors',
        credentials: 'same-origin'
      })

      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`)
      }

      lists = await response.json()
      loadState = LoadState.Success
    } catch (error) {
      loadState = LoadState.Error
    }
  }

  $effect(() => {
    load()
  })
</script>

<h2><List />Your lists</h2>
<hr />

{#if loadState === LoadState.Success}
  <div>Total: {lists.length}</div>
  <br />
  <br />
  <div class="list">
    {#each lists as list, index (list.id)}
      <div class="list-item">
        <div class="list-name">
          <span class="list-index">{index +1}.</span> <Link to="/lists/{list.id}" state={list}>{list.name || 'Untitled'}</Link>
        </div>
        <button
          class="icon"
          onclick={() => navigator.clipboard.writeText(list.id)}
          alt="Copy to clipboard"><Copy /></button
        >
      </div>
    {/each}
  </div>

  <br />
  <br />
  <hr />

  <CreateListForm bind:lists />
  <br />
  <br />
  <JoinListForm />
{:else if loadState === LoadState.Error}
  <p>Error</p>
  <button id="refresh" data-testid="refresh" onclick={() => load()} alt="Refresh lists"
    >Try again</button
  >
{:else}
  <p>Loading...</p>
{/if}

<style>
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
    gap: 0.5rem;
  }
  .list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .list-name {
    display: flex;
    gap: 0.5rem;
    font-size: 1.5rem;
    align-items: center;
  }
  .list-index{
    font-size: 1rem;
    color: 818690;
    min-width:1.6rem;
  }
</style>
