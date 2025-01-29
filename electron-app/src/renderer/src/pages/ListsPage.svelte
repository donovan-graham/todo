<script lang="ts">
  import { Link } from 'svelte-routing'
  import { user } from '../stores/user.svelte'
  import CreateListForm from '../components/CreateListForm.svelte'
  import JoinListForm from '../components/JoinListForm.svelte'

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

<h1>Lists</h1>

{#if loadState === LoadState.Success}
  {#each lists as list (list.id)}
    <div>
      <Link to="/lists/{list.id}">{list.id}</Link>: {list.name || 'Untitled'}: {list.created_at}
    </div>
  {/each}
  <button id="refresh" data-testid="refresh" onclick={() => load()}>Refresh</button>

  <CreateListForm bind:lists />

  <JoinListForm />
{:else if loadState === LoadState.Error}
  <p>Error</p>
  <button id="refresh" data-testid="refresh" onclick={() => load()}>Refresh</button>
{:else}
  <p>Loading...</p>
{/if}
