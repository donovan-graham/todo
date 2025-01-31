<script lang="ts">
  import { Router, Link, Route } from 'svelte-routing'

  import { user } from './stores/user.svelte'
  
  import Nav from './components/Nav.svelte'
  import LoginPage from './pages/LoginPage.svelte'
  import ListsPage from './pages/ListsPage.svelte'
  import ListPage from './pages/ListPage.svelte'
  
  import LoginForm from './components/LoginForm.svelte'
  import RegisterForm from './components/RegisterForm.svelte'

  let url = $state('/')
</script>

<div class="container">
<Router {url}>
  <header>
    <h1>Todo Lists</h1>
    <Nav />
  </header>
  
  <main>
    <div>
      <Route path="/lists/:id" let:params>
        <ListPage id={params.id} />
      </Route>
      <Route path="/lists" component={ListsPage} />
      <Route path="/"> 
          {#if user.authToken}
            <ListsPage />
          {:else}
            <LoginForm />
          {/if}
      </Route>
      <Route path="/login" component={LoginForm} />
      <Route path="/register" component={RegisterForm} />
    </div>
  </main>
</Router>
</div>

<footer>
  Made by &nbsp;<a href="mailto:donovan@platform7.com">Donovan Graham</a>
</footer>
