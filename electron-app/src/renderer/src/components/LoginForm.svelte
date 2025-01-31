<script lang="ts">
  import { Link } from 'svelte-routing'
  import { useForm } from 'svelte-simple-form'
  import { z } from 'zod'
  import { user } from '../stores/user.svelte'
  import { navigate } from 'svelte-routing'

  const schema = z.object({
    username: z.string().trim().min(3).max(255),
    password: z.string().trim().min(3).max(255)
  })

  type DataType = z.infer<typeof schema>

  const { form, enhance } = useForm<DataType>({
    initialValue: {
      username: '',
      password: ''
    },
    schema,
    onSubmit: async (data) => {
      const body = JSON.stringify({ username: data.username, password: data.password })
      const url = 'http://localhost:3000/api/v1/login'
      try {
        const response = await fetch(url, {
          method: 'POST',
          body,
          headers: {
            'Content-Type': 'application/json'
          },
          mode: 'cors',
          credentials: 'same-origin'
        })

        if (!response.ok) {
          form.setError('password', ['Invalid username or password'])
          return
          // throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json()

        user.authToken = json.token
        navigate('/lists', { replace: true })
      } catch (error) {
        console.error('fetch >>', error.message)
      } finally {
        form.setIsSubmitting(false)
      }
    }
  })
</script>

<form use:enhance id="login-form">
  <h2>Login</h2>

  <label for="login-username">Username</label>
  <fieldset>
    <input
      type="text"
      id="login-username"
      data-testid="login-username"
      name="login-username"
      bind:value={form.data.username}
    />
    {#if form.errors.username?.length}
      <p class="field-error">{form.errors.username.join(', ')}</p>
    {/if}
  </fieldset>

  <label for="login-password">Password</label>
  <fieldset>
    <input
      type="password"
      id="login-password"
      data-testid="login-password"
      name="login-password"
      bind:value={form.data.password}
    />
    {#if form.errors.password?.length}
      <p class="field-error">{form.errors.password.join(', ')}</p>
    {/if}
  </fieldset>

  <button
    type="submit"
    class="form-button"
    id="login-submit"
    data-testid="login-submit"
    disabled={form.isSubmitting}>Login</button
  >

  <span class="other-links">Don't have an account? <Link to="/register">Register</Link></span>
</form>
