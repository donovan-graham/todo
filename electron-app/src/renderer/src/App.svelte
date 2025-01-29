<script lang="ts">
  import { Router, Link, Route } from 'svelte-routing'

  import { user } from './stores/user.svelte'

  import HomePage from './pages/HomePage.svelte'
  import AboutPage from './pages/AboutPage.svelte'
  import LoginPage from './pages/LoginPage.svelte'
  import ListsPage from './pages/ListsPage.svelte'
  import ListPage from './pages/ListPage.svelte'

  
  import Nav from './components/Nav.svelte'
  import LoginForm from './components/LoginForm.svelte'

  let url = $state('/')
</script>

<main>
  <Router {url}>
    <Nav />

    <div>
      <Route path="/lists/:id" let:params>
        <ListPage id={params.id} />
      </Route>
      <Route path="/lists" component={ListsPage} />
      <Route path="/" component={LoginPage} />
    </div>
  </Router>
</main>
