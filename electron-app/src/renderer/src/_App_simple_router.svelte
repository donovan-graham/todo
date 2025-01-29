<script lang="ts">
  import svelteLogo from './assets/svelte.svg'
  import viteLogo from './assets/vite.svg'

  import { RouterView } from '@dvcol/svelte-simple-router/components'
  import type { Route, RouterOptions } from '@dvcol/svelte-simple-router/models'

  import Nav from './components/Nav.svelte'
  import Home from '../pages/HomePage.svelte'
  import About from '../pages/AboutPage.svelte'

  const RouteName = {
    Home: 'home',
    About: 'about',
    Any: 'any'
  } as const

  type RouteNames = (typeof RouteName)[keyof typeof RouteName]

  export const routes: Readonly<Route<RouteNames>[]> = [
    {
      name: RouteName.Home,
      path: '/',
      component: Home
    },
    {
      name: RouteName.About,
      path: `/${RouteName.About}`,
      component: About
    },
    {
      name: RouteName.Any,
      path: '*',
      redirect: {
        name: RouteName.Home
      }
    }
  ] as const

  export const options: RouterOptions<RouteNames> = {
    routes
  } as const
</script>

<main>
  <div>
    <a href="https://vite.dev" target="_blank" rel="noreferrer">
      <img src={viteLogo} class="logo" alt="Vite Logo" />
    </a>
    <a href="https://svelte.dev" target="_blank" rel="noreferrer">
      <img src={svelteLogo} class="logo svelte" alt="Svelte Logo" />
    </a>
  </div>
  <h1>Vite + Svelte</h1>

  <RouterView {options}>
    <Nav />
    {@render children?.()}
  </RouterView>
</main>

<style>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
</style>
