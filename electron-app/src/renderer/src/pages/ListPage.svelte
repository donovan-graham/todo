<script lang="ts">
    import { Link } from "svelte-routing";

    import { user } from "../stores/user.svelte";
    import { ListWebSocket } from "../stores/listWebSocket.svelte";

    import type { fromStore } from "svelte/store"


    const {id} = $props()
    const list = new ListWebSocket()


    const count = $derived(list.todos.length)
    // $inspect(list, count);

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

</script>

&laquo; <Link to="/lists">back to lists</Link>
<h1>List: {id} {name}</h1>

{#if list.isConnected}

    {#if count === 0}
        <p>Make your first todo</p>
    {:else}
        <div>Total: {count}</div>
        {#each list.todos as todo (todo.id)}
            <div>
                <p>{todo.position} {todo.id} {todo.description}</p>
            </div>
        {/each}
    {/if}
    

    <button onclick={() => list.createTodo()}>Create Todo</button>

{:else if list.isFetching}
    <p>Loading...</p>
{:else}
    <p>Connecting...</p>
{/if}

