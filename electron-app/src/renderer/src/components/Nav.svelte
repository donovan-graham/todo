<script lang="ts">
  import { Link, navigate } from 'svelte-routing'
  import { user } from '../stores/user.svelte'

  const logout = (event) => {
    event.preventDefault()
    user.clear()
    navigate('/')
  }
</script>

{#if user.isAuthenticated}
  <p>Welcome, {user.username}!</p>
{/if}

<nav>
  {#if user.isAuthenticated}
    <Link to="/lists">Lists</Link>
    <a href="/logout" onclick={logout}>Logout</a>
  {:else}
    <Link to="/">Login/Signup</Link>
  {/if}
</nav>
