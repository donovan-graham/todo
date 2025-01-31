<script lang="ts">
  import { link, Link, navigate } from 'svelte-routing'
  import { user } from '../stores/user.svelte'

  import { Smile, LogIn, LogOut, List, UserPlus } from 'lucide-svelte'

  const logout = (event) => {
    event.preventDefault()
    user.clear()
    navigate('/')
  }

  const navs = [
    { id: 1, name: 'Lists', to: '/lists', icon: List, isAuth: true },
    { id: 2, name: 'Logout', to: '/logout', icon: LogOut, isAuth: true, click: logout },
    { id: 3, name: 'Login', to: '/login', icon: LogIn, isAuth: false },
    { id: 4, name: 'Register', to: '/register', icon: UserPlus, isAuth: false }
  ]
</script>

<div class="inline">
  <nav>
    {#each navs as nav (nav.id)}
      {#if user.isAuthenticated === nav.isAuth}
        <Link to={nav.to} onclick={(e) => nav?.click?.(e)}>
          <svelte:component this={nav.icon} />
          <span>{nav.name}</span>
        </Link>
      {/if}
    {/each}
  </nav>

  
    {#if user.isAuthenticated}
    <p class="welcome-message"><Smile /> Welcome, {user.username}!</p>
    {/if}

</div>

<style>
  .inline {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .welcome-message {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
</style>
